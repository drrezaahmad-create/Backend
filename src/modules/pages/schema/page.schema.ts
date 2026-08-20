import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PageKey } from '../enum/page-key.enum';

@Schema({ timestamps: true })
export class Page extends Document {
  @Prop({ required: true, enum: Object.values(PageKey), unique: true, index: true })
  key: PageKey;

  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ required: true }) // store HTML or markdown
  content: string;

  @Prop()
  imageUrl?: string;
}

export const PageSchema = SchemaFactory.createForClass(Page);
