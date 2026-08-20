import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateProcedureDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}
