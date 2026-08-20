export class FavouriteProductResponseDto {
  id: string;

  product: any;

  addedAt: Date;

  user: string;
}

export class FavouritesListResponseDto {
  favourites: FavouriteProductResponseDto[];

  total: number;

  page: number;

  limit: number;

  totalPages: number;
}

export class FavouriteStatusResponseDto {
  isFavourite: boolean;

  favouriteId?: string;
}
