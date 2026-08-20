import { Injectable, InternalServerErrorException } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private readonly configService: ConfigService) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new InternalServerErrorException('STRIPE_SECRET_KEY is not set');
    }
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2025-08-27.basil',
      typescript: true,
    });
  }

  async createCheckoutSession(params: {
    orderId: string;
    products: { name: string; price: number; quantity: number }[];
    customerEmail?: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    try {
      const lineItems = params.products.map((item) => ({
        price_data: {
          currency: 'gbp', // Currency set to GBP
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      }));

      return await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        customer_email: params.customerEmail,
        client_reference_id: params.orderId,
        metadata: { orderId: params.orderId },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Stripe session creation failed',
      );
    }
  }

  async constructEvent(payload: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new InternalServerErrorException('STRIPE_WEBHOOK_SECRET not set');
    }
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  }
}
