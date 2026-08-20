import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsArray,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsMongoId,
  Min,
  IsNotEmpty,
  IsString as IsStringType,
} from 'class-validator';
import { ProductAvailability } from 'src/common/enum/product-availability.enum';

export class CreateProductDto {
  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  productCode?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  stock?: number;

  @IsMongoId()
  @IsNotEmpty()
  category: string;

  @IsMongoId()
  @IsNotEmpty()
  brand: string;

  @IsMongoId()
  @IsOptional()
  procedure: string;

  @IsOptional()
  @IsArray()
  @IsStringType({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [value];
      }
    }
    return value;
  })
  images?: string[];

  @IsEnum(ProductAvailability)
  @IsOptional()
  availability?: ProductAvailability;

  @IsNumber()
  @Min(0)
  @IsOptional()
  salesCount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  views?: number;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === '1' || value === 1) return true;
    if (value === 'false' || value === false || value === '0' || value === 0) return false;
    return value;
  })
  isPublished?: boolean;

  @IsString()
  @IsOptional()
  productUrl?: string;
}
