import {
  IsMongoId,
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsEnum,
  IsOptional,
  Min,
} from 'class-validator';
import { PaymentMethod } from 'src/common/enum/payment.enum';

class OrderProductDto {
  @IsMongoId()
  product: string;

  @IsString()
  name: string;

  @IsNumber()
  price: number;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  image: string;
}

export class CreateOrderDto {
  @IsMongoId()
  addressId: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  // Server-calculated fields
  @IsNumber()
  @IsOptional()
  subtotal?: number;

  @IsNumber()
  @IsOptional()
  total?: number;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}
