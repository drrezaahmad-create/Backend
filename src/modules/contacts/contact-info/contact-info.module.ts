import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContactInfo, ContactInfoSchema } from './contact-info.schema';
import { ContactInfoController } from './contact-info.controller';
import { ContactInfoService } from './contact-info.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContactInfo.name, schema: ContactInfoSchema },
    ]),
  ],
  controllers: [ContactInfoController],
  providers: [ContactInfoService],
})
export class ContactInfoModule {}
