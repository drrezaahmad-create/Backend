import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsEmail,
} from 'class-validator';

export class CreateAddressDto {
  @IsNotEmpty()
  @IsString()
  streetNo: string;

  @IsOptional()
  @IsString()
  houseNoApartmentFloor?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsNotEmpty()
  @IsString()
  city: string;

  @IsNotEmpty()
  @IsString()
  state: string;

  @IsNotEmpty()
  @IsString()
  postalCode: string;

  @IsNotEmpty()
  @IsString()
  country: string;

  @IsOptional()
  @IsEnum(['home', 'office'])
  type?: 'home' | 'office';

  @IsOptional()
  @IsString()
  recipientFirstName?: string;

  @IsOptional()
  @IsString()
  recipientLastName?: string;

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @IsOptional()
  @IsString()
  recipientPhone?: string;
}
