import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Address, AddressSchema } from './address.schema';
import { AddressService } from './address.service';
import { AddressController } from './address.controller';
import { UsersModule } from 'src/modules/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Address.name, schema: AddressSchema }]),
    forwardRef(() => UsersModule),
  ],
  controllers: [AddressController],
  providers: [AddressService],
  exports: [AddressService,MongooseModule],
})
export class AddressModule {}
