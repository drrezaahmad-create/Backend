import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './order.schema';
import { OrdersController } from 'src/modules/order/order.controller';
import { OrderService } from 'src/modules/order/order.service';
import { AddressModule } from 'src/modules/address/address.module';
import { CartModule } from 'src/modules/cart/cart.module';
import * as express from 'express';
import { ProductsModule } from 'src/modules/products/products.module';
import { CheckoutController } from 'src/modules/order/checkout.controller';
import { StripeWebhookController } from 'src/modules/order/stripe.controller';
import { StripeService } from 'src/modules/order/stripe.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    AddressModule,
    CartModule,
    ProductsModule,
  ],
  controllers: [OrdersController, StripeWebhookController, CheckoutController],
  providers: [OrderService, StripeService],
  exports: [OrderService, StripeService],
})
export class OrderModule {}
