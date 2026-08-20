// contact-info.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ContactInfoDocument = ContactInfo & Document;

@Schema({ timestamps: true })
export class ContactInfo {
  @Prop({ type: [String], default: [] })
  emails: string[];

  @Prop({ type: [String], default: [] })
  phone: string[]; 

  @Prop()
  facebook?: string;

  @Prop()
  twitter?: string;

  @Prop()
  instagram?: string;
}

export const ContactInfoSchema = SchemaFactory.createForClass(ContactInfo);
