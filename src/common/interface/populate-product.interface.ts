import { Types } from 'mongoose';
import { ProductAvailability } from 'src/common/enum/product-availability.enum';

export default interface PopulatedProduct {
  _id: Types.ObjectId;
  name: string;
  price: number;
  imageUrl: string[];
  availability: ProductAvailability;
  stock: number;
}
