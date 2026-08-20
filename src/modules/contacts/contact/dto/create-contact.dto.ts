import { IsString, IsOptional } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  subject: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  email?: string; // for guest users
}
