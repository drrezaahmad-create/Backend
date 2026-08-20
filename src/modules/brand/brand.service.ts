import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Brand } from './brand.schema';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandService {
  constructor(
    @InjectModel(Brand.name) private readonly brandModel: Model<Brand>,
  ) {}

  async create(createBrandDto: CreateBrandDto): Promise<Brand> {
    try {
      const brand = new this.brandModel(createBrandDto);
      return await brand.save();
    } catch (error) {
      throw new InternalServerErrorException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message || 'Failed to create brand',
      });
    }
  }

  async findAll(
    page = 1,
    limit = 10,
  ): Promise<{
    data: Brand[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    // Fetch brands and total count concurrently
    const [brands, total] = await Promise.all([
      this.brandModel.find().skip(skip).limit(limit).exec(),
      this.brandModel.countDocuments().exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: brands,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: string): Promise<Brand> {
    const brand = await this.brandModel.findById(id).exec();
    if (!brand) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Brand with ID ${id} not found`,
      });
    }
    return brand;
  }

  async update(id: string, updateBrandDto: UpdateBrandDto): Promise<Brand> {
    const updated = await this.brandModel
      .findByIdAndUpdate(id, updateBrandDto, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Brand with ID ${id} not found`,
      });
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const brand = await this.findOne(id);
    await this.brandModel.findByIdAndDelete(id).exec();
  }
}
