import { IsArray, IsEmail, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateContactInfoDto {
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emails?: string[];

  @IsOptional()
  @IsArray()
  phone?: string[];

  @IsOptional()
  @IsUrl()
  facebook?: string;

  @IsOptional()
  @IsUrl()
  twitter?: string;

  @IsOptional()
  @IsUrl()
  instagram?: string;
}
