// src/modules/favourites/schema/favourite-product.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FavouriteProductDocument = FavouriteProduct & Document;

@Schema({
  timestamps: true,
})
export class FavouriteProduct {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true
  })
  user: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Product',
    required: true
  })
  product: Types.ObjectId;

  @Prop({ default: Date.now })
  addedAt: Date;
}

export const FavouriteProductSchema =
  SchemaFactory.createForClass(FavouriteProduct);

// Compound unique index to prevent duplicates
FavouriteProductSchema.index({ user: 1, product: 1 }, { unique: true });

// Index for efficient querying by user with sorting
FavouriteProductSchema.index({ user: 1, addedAt: -1 });
