import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Newsletter extends Document {
  @Prop({ required: true })
  content: string;

  @Prop({ default: Date.now })
  sentAt: Date;
}

export const NewsletterSchema = SchemaFactory.createForClass(Newsletter);
