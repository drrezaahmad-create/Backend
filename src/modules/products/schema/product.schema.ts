import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ProductAvailability } from 'src/common/enum/product-availability.enum';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {
  @Prop({
    required: true,
    trim: true,
    maxlength: 200,
  })
  name: string;

  @Prop({
    type: String,
    trim: true,
    maxlength: 500,
    default: '',
  })
  productId: string;

  @Prop({
    type: String,
    trim: true,
    maxlength: 500,
    default: '',
  })
  productCode: string;

  @Prop({
    trim: true,
  })
  description: string;

  @Prop({
    required: true,
    min: 0,
  })
  price: number;

  @Prop({
    default: 0,
    min: 0,
  })
  stock: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'Category',
    required: true,
  })
  category: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Brand',
    required: true,
  })
  brand: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Procedure',
    required: false,
  })
  procedure: Types.ObjectId;

  @Prop({
    type: String,
    trim: true,
    maxlength: 200,
    default: '',
  })
  procedureName: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({
    required: true,
    enum: Object.values(ProductAvailability),
    default: ProductAvailability.IN_STOCK,
  })
  availability: ProductAvailability;

  @Prop({ default: 0 })
  salesCount: number;

  @Prop({ default: 0 })
  views: number;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: true })
  isPublished: boolean;

  @Prop({
    type: String,
    trim: true,
    maxlength: 200,
    default: '',
  })
  productUrl: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: false,
  })
  user?: Types.ObjectId;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Compound indexes for better query performance
ProductSchema.index({ category: 1, availability: 1 });
ProductSchema.index({ brand: 1, availability: 1 });
ProductSchema.index({ procedure: 1, availability: 1 });
ProductSchema.index({ isFeatured: 1, availability: 1 });
ProductSchema.index({ isPublished: 1 });
ProductSchema.index({ price: 1, availability: 1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ name: 'text', description: 'text' });
