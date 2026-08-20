import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Blog extends Document {
  @Prop({ required: true })
  title: string;

  @Prop()
  content: string;

  @Prop({ type: [String], default: [] })
  imageUrl: string[];

  @Prop({ type: Date, default: null })
  publishDate: Date | null;  
}

export const BlogSchema = SchemaFactory.createForClass(Blog);
