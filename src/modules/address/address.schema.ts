import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/modules/users/schema/user.schema';

export type AddressDocument = Address & Document;

@Schema({ timestamps: true })
export class Address {
  @Prop({ required: true })
  streetNo: string;

  @Prop()
  houseNoApartmentFloor?: string; // House No / Apartment / Floor

  @Prop()
  area?: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  state: string;

  @Prop({ required: true })
  postalCode: string;

  @Prop({ required: true })
  country: string;

  @Prop({ type: String, enum: ['home', 'office'], default: 'home' })
  type?: 'home' | 'office';

  // Fields for the recipient's name and phone (if different from the user who owns the address)
  @Prop()
  recipientFirstName?: string; // Optional: Name of the person at this address

  @Prop()
  recipientLastName?: string; // Optional: Name of the person at this address

  @Prop()
  recipientEmail?: string; // Optional: Email of the person at this address

  @Prop()
  recipientPhone?: string; // Optional: Phone number for the recipient at this address

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;
}

export const AddressSchema = SchemaFactory.createForClass(Address);
