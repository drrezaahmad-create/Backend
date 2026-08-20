import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Procedure, ProcedureSchema } from './procedure.schema';
import { FileUploadModule } from '../file-upload/file-upload.module';
import { ProceduresController } from 'src/modules/procedure/procedure.controller';
import { ProceduresService } from 'src/modules/procedure/procedure.service';
import {
  Product,
  ProductSchema,
} from 'src/modules/products/schema/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Procedure.name, schema: ProcedureSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    FileUploadModule,
  ],
  controllers: [ProceduresController],
  providers: [ProceduresService],
  exports: [ProceduresService],
})
export class ProcedureModule {}
