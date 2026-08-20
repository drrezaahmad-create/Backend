import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Blog } from './blog.schema';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { FileUploadService } from '../../file-upload/file-upload.service';
import { NotificationService } from 'src/modules/notification/notification.service';

@Injectable()
export class BlogService {
  constructor(
    @InjectModel(Blog.name) private blogModel: Model<Blog>,
    private readonly fileUploadService: FileUploadService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(
    createBlogDto: CreateBlogDto,
    files: Express.Multer.File[],
  ): Promise<Blog> {
    try {
      let imageUrl: string[] = [];
      if (files && files.length > 0) {
        imageUrl = await Promise.all(
          files.map((file) => this.fileUploadService.handleUpload(file)),
        );
      }

      const createdBlog = new this.blogModel({
        ...createBlogDto,
        imageUrl,
        publishDate: createBlogDto.publishDate
          ? new Date(createBlogDto.publishDate)
          : null,
      });

      const savedBlog = await createdBlog.save();

      // --- NOTIFY ADMINS ---
      const admins = await this.blogModel.db
        .model('User')
        .find({ role: 'admin' })
        .exec();
      await Promise.all(
        admins.map((admin: any) =>
          this.notificationService.createNotification({
            title: 'New Blog Created',
            body: `A new blog "${savedBlog.title}" was just published.`,
            user: admin._id.toString(),
            metadata: { blogId: savedBlog._id },
          }),
        ),
      );

      return savedBlog;
    } catch (error) {
      throw new InternalServerErrorException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message || 'Blog creation failed',
      });
    }
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string,
  ): Promise<{
    data: Blog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const query: any = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.blogModel
        .find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }) // Sort by newest first
        .exec(),
      this.blogModel.countDocuments(query).exec(),
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

  async findOne(id: string): Promise<Blog> {
    const blog = await this.blogModel.findById(id).exec();
    if (!blog) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Blog with ID ${id} not found`,
      });
    }
    return blog;
  }

  async update(
    id: string,
    updateBlogDto: UpdateBlogDto,
    files: Express.Multer.File[],
  ): Promise<Blog> {
    const existingBlog = await this.findOne(id);

    try {
      // Initialize as empty array if undefined
      let newImageUrls: string[] = existingBlog.imageUrl || [];

      if (files && files.length > 0) {
        // Delete old images if new ones are uploaded
        if (existingBlog.imageUrl && existingBlog.imageUrl.length > 0) {
          await Promise.all(
            existingBlog.imageUrl.map((url) =>
              this.fileUploadService.deleteFile(url),
            ),
          );
        }
        newImageUrls = await Promise.all(
          files.map((file) => this.fileUploadService.handleUpload(file)),
        );
      }

      const updatedBlog = await this.blogModel
        .findByIdAndUpdate(
          id,
          {
            ...updateBlogDto,
            imageUrl: newImageUrls,
            publishDate: updateBlogDto.publishDate
              ? new Date(updateBlogDto.publishDate)
              : existingBlog.publishDate,
          },
          { new: true },
        )
        .exec();

      if (!updatedBlog) {
        throw new NotFoundException({
          statusCode: HttpStatus.NOT_FOUND,
          message: `Blog with ID ${id} not found`,
        });
      }

      return updatedBlog;
    } catch (error) {
      throw new InternalServerErrorException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message || 'Blog update failed',
      });
    }
  }

  async remove(id: string): Promise<void> {
    const blog = await this.findOne(id);

    // Delete associated images if exist
    if (blog.imageUrl && blog.imageUrl.length > 0) {
      await Promise.all(
        blog.imageUrl.map((url) => this.fileUploadService.deleteFile(url)),
      );
    }

    const result = await this.blogModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Blog with ID ${id} not found`,
      });
    }
  }
}
