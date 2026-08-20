import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Slider } from './slider.schema';
import { FileUploadService } from 'src/modules/file-upload/file-upload.service';

@Injectable()
export class SliderService {
  constructor(
    @InjectModel(Slider.name) private sliderModel: Model<Slider>,
    private readonly fileUploadService: FileUploadService,
  ) {}

  async create(file: Express.Multer.File): Promise<Slider> {
    if (!file) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'No image file uploaded',
      });
    }

    try {
      const imageUrl = await this.fileUploadService.handleUpload(file);
      const slider = new this.sliderModel({ imageUrl });
      return await slider.save();
    } catch (error) {
      throw new InternalServerErrorException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message || 'Slider creation failed',
      });
    }
  }

  async findAll(): Promise<Slider[]> {
    return this.sliderModel.find().sort({ createdAt: -1 }).exec();
  }

  async update(id: string, file: Express.Multer.File): Promise<Slider> {
    const existingSlide = await this.sliderModel.findById(id).exec();

    if (!existingSlide) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Slider with ID ${id} not found`,
      });
    }

    if (!file) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'No image file uploaded',
      });
    }

    try {
      // Upload new image
      const newImageUrl = await this.fileUploadService.handleUpload(file);

      // Delete old image
      if (existingSlide.imageUrl) {
        await this.fileUploadService.deleteFile(existingSlide.imageUrl);
      }

      // Update and save
      existingSlide.imageUrl = newImageUrl;
      return await existingSlide.save();
    } catch (error) {
      throw new InternalServerErrorException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message || 'Slider update failed',
      });
    }
  }

  async remove(id: string): Promise<void> {
    const slider = await this.sliderModel.findById(id).exec();
    if (!slider) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Slider with ID ${id} not found`,
      });
    }

    await this.fileUploadService.deleteFile(slider.imageUrl);
    await this.sliderModel.findByIdAndDelete(id).exec();
  }
}
