import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category } from './category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { FileUploadService } from 'src/modules/file-upload/file-upload.service';

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<Category>,
    private readonly fileUploadService: FileUploadService,
  ) {}

  async create(
    createCategoryDto: CreateCategoryDto,
    file: Express.Multer.File,
  ): Promise<Category> {
    try {
      if (!file) {
        throw new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'No file uploaded',
        });
      }

      const imageUrl = await this.fileUploadService.handleUpload(file);

      const category = new this.categoryModel({
        name: createCategoryDto.name,
        imageUrl,
      });

      return await category.save();
    } catch (error) {
      throw new InternalServerErrorException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message || 'Category creation failed',
      });
    }
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string, // search for categories
  ): Promise<{
    data: Category[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const query: any = {}; 
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.categoryModel
        .find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: 1 })
        .exec(),
      this.categoryModel.countDocuments(query).exec(), // Get total count based on filters
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryModel.findById(id).exec();
    if (!category) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Category with ID ${id} not found`,
      });
    }
    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
    file: Express.Multer.File,
  ): Promise<Category> {
    const existingCategory = await this.findOne(id);
    let newImageUrl = existingCategory.imageUrl;

    if (file) {
      newImageUrl = await this.fileUploadService.handleUpload(file);
      if (existingCategory.imageUrl) {
        await this.fileUploadService.deleteFile(existingCategory.imageUrl);
      }
    }

    const updatedCategory = await this.categoryModel
      .findByIdAndUpdate(
        id,
        {
          name: updateCategoryDto.name || existingCategory.name,
          imageUrl: newImageUrl,
        },
        { new: true },
      )
      .exec();

    if (!updatedCategory) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Category with ID ${id} not found`,
      });
    }

    return updatedCategory;
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    if (category.imageUrl) {
      await this.fileUploadService.deleteFile(category.imageUrl);
    }
    await this.categoryModel.findByIdAndDelete(id).exec();
  }
}
