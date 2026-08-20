import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Body,
} from '@nestjs/common';
import Stripe from 'stripe';
import { OrderService } from './order.service';
import { StripeService } from './stripe.service';
import { PaymentStatus } from 'src/common/enum/payment.enum';

@Controller('webhook')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly ordersService: OrderService,
  ) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() req,
    @Headers('stripe-signature') signature: string,
  ) {
    const payload = req.body;
    if (!payload || payload.length === 0) {
      this.logger.error('Empty webhook body received');
      return { received: false };
    }

    try {
      const event = await this.stripeService.constructEvent(payload, signature);
      this.logger.log(`Stripe event received: ${event.type} (ID: ${event.id})`);

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          this.logger.log(
            `Session completed for order ${session.client_reference_id}`,
          );
          await this.handleCheckoutSessionCompleted(session);
          break;
        }
        case 'payment_intent.succeeded': {
          const pi = event.data.object as Stripe.PaymentIntent;
          this.logger.log(`PaymentIntent succeeded: ${pi.metadata?.orderId}`);
          await this.handlePaymentIntentSucceeded(pi);
          break;
        }
        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (err) {
      this.logger.error(`Webhook Error: ${err.message}`);
      return { received: false, error: err.message };
    }
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ) {
    const orderId = session.client_reference_id || session.metadata?.orderId;
    if (!orderId) {
      this.logger.warn('Missing order ID in Stripe session');
      return;
    }

    if (session.payment_status === 'paid') {
      await this.ordersService.updatePaymentStatus(
        orderId,
        PaymentStatus.SUCCEEDED,
        session.payment_intent as string,
      );
      this.logger.log(`Payment succeeded for order ${orderId}`);
    }
  }

  private async handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
    const orderId = session.client_reference_id || session.metadata?.orderId;
    if (!orderId) {
      this.logger.warn('Missing order ID in expired Stripe session');
      return;
    }
    // Cancel order and restore stock
    await this.ordersService.updatePaymentStatus(orderId, PaymentStatus.FAILED);
    this.logger.log(
      `Session expired for order ${orderId}; order cancelled and stock restored`,
    );
  }

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ) {
    const orderId = paymentIntent.metadata?.orderId;
    if (!orderId) return;

    await this.ordersService.updatePaymentStatus(
      orderId,
      PaymentStatus.SUCCEEDED,
      paymentIntent.id,
    );
    this.logger.log(`Payment intent succeeded for order ${orderId}`);
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const orderId = paymentIntent.metadata?.orderId;
    if (!orderId) return;

    await this.ordersService.updatePaymentStatus(
      orderId,
      PaymentStatus.FAILED,
      paymentIntent.id,
    );
    this.logger.error(
      `Payment failed for order ${orderId}: ${paymentIntent.last_payment_error?.message}`,
    );
  }
}
// stripe listen --api-key YOUR_STRIPE_SECRET_KEY --forward-to http://localhost:5050/api/webhook/stripe
