import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Slider extends Document {
  @Prop({ required: true })
  imageUrl: string;
}

export const SliderSchema = SchemaFactory.createForClass(Slider);
