import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FavouritesService } from './favourites.service';
import { FavouritesController } from './favourites.controller';
import { FavouriteProduct, FavouriteProductSchema } from './schema/favourite-product.schema';
import { ProductsModule } from '../products/products.module';
import { UsersModule } from '../users/users.module';
import { ProductsService } from '../products/products.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FavouriteProduct.name, schema: FavouriteProductSchema },
    ]),
    forwardRef(() => ProductsModule),
    UsersModule,
  ],
  controllers: [FavouritesController], 
  providers: [
    FavouritesService,
    {
      provide: 'PRODUCTS_SERVICE',
      useExisting: forwardRef(() => ProductsService),
    },
  ],
  exports: [FavouritesService],
})
export class FavouritesModule {}
