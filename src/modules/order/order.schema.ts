import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrderStatus } from 'src/common/enum/order_status.enum';
import { PaymentMethod, PaymentStatus } from 'src/common/enum/payment.enum';

@Schema({ timestamps: true })
export class Order extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop([
    {
      product: { type: Types.ObjectId, ref: 'Product', required: true },
      name: String,
      price: Number,
      quantity: Number,
      image: String,
    },
  ])
  products: {
    product: Types.ObjectId;
    name: string;
    price: number;
    quantity: number;
    image: string;
  }[];

  @Prop({ type: Types.ObjectId, ref: 'Address', required: true })
  address: Types.ObjectId;

  @Prop({ type: String, enum: PaymentMethod, required: true })
  paymentMethod: PaymentMethod;

  @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Prop({ required: true })
  subtotal: number;

  // @Prop({ required: true })
  // shippingFee: number;

  @Prop({ required: true })
  total: number;

  @Prop()
  stripePaymentIntentId?: string;

  @Prop()
  idempotencyKey?: string;

  @Prop()
  trackingNumber?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
