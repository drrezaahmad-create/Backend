import { Module } from '@nestjs/common';
import { GlobalSearchController } from './global-search.controller';
import { GlobalSearchService } from './global-search.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Product,
  ProductSchema,
} from 'src/modules/products/schema/product.schema';
import {
  Category,
  CategorySchema,
} from 'src/modules/categories/category.schema';
import {
  Procedure,
  ProcedureSchema,
} from 'src/modules/procedure/procedure.schema';
import { Brand, BrandSchema } from 'src/modules/brand/brand.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Brand.name, schema: BrandSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Procedure.name, schema: ProcedureSchema },
    ]),
  ],
  controllers: [GlobalSearchController],
  providers: [GlobalSearchService],
})
export class GlobalSearchModule {}
