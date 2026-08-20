import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  Length,
} from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @Transform(({ value }) => value.toString())
  @IsString()
  @Length(6, 6, { message: 'Code must be exactly 6 characters' })
  code: string;
}
