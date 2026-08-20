import { IsString, IsOptional, IsArray, IsDateString } from 'class-validator';

export class CreateBlogDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @IsOptional()
  imageUrl?: string[];

  @IsOptional()
  @IsDateString()
  publishDate?: string;
}
