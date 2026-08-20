import { IsMongoId, IsBoolean } from 'class-validator';

export class ToggleFavouriteDto {
  @IsMongoId()
  productId: string;

  @IsBoolean()
  isFavourite: boolean;
}
