import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageKey } from '../enum/page-key.enum';

export class CreatePageDto {
  @IsEnum(PageKey)
  key: PageKey; // 'terms' | 'privacy' | 'about'

  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  content: string; // You can store HTML/markdown

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
