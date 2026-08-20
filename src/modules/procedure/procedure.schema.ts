import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Procedure extends Document {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop()
  description?: string;

  @Prop()
  imageUrl: string;
}

export const ProcedureSchema = SchemaFactory.createForClass(Procedure);
