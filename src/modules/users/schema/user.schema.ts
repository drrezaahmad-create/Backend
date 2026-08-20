import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserStatus } from 'src/common/enum/user.status.enum';
import { Role } from 'src/common/enum/user_role.enum';

export type UserDocument = User & Document;
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ enum: Role, default: Role.DENTIST })
  role: Role;

  @Prop()
  phone?: string;

  @Prop()
  imageUrl?: string;

  @Prop()
  gdcNumber?: string;

  @Prop()
  clinicName?: string;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ enum: UserStatus, default: UserStatus.PENDING })
  status: UserStatus;

  @Prop({ type: String, default: null })
  refreshToken?: string | null;

  @Prop({ type: String, default: null })
  resetPasswordCodeHash?: string | null;

  @Prop({ type: Date, default: null })
  resetPasswordExpires?: Date | null;

  @Prop({ type: String, default: null })
  emailVerificationCodeHash?: string | null;

  @Prop({ type: Date, default: null })
  emailVerificationExpires?: Date | null;

  @Prop({ type: Date, default: null })
  emailVerifiedAt?: Date | null; // optional convenience
}

export const UserSchema = SchemaFactory.createForClass(User);
