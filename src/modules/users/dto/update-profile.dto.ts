import { IsString, IsOptional, IsPhoneNumber, IsEmail } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  gdcNumber?: string;

  @IsString()
  @IsOptional()
  clinicName?: string;
}
