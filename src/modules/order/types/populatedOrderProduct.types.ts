import { Types } from 'mongoose';
import { Product } from 'src/modules/products/schema/product.schema';

export interface PopulatedOrderProduct {
    product: Product | null;
    quantity: number;
    name: string;
    price: number;
    image: string;
    _id: Types.ObjectId;
  }
  