import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Slider, SliderSchema } from './slider.schema';
import { SliderService } from './slider.service';
import { SliderController } from './slider.controller';
import { FileUploadService } from 'src/modules/file-upload/file-upload.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Slider.name, schema: SliderSchema }])],
  controllers: [SliderController],
  providers: [SliderService, FileUploadService],
})
export class SliderModule {}
