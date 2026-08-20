import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Page } from './schema/page.schema';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { FileUploadService } from '../file-upload/file-upload.service';
import { PageKey } from './enum/page-key.enum';

@Injectable()
export class PagesService {
  constructor(
    @InjectModel(Page.name) private readonly pageModel: Model<Page>,
    private readonly fileUploadService: FileUploadService,
  ) {}

  async create(dto: CreatePageDto, file?: Express.Multer.File): Promise<Page> {
    try {
      const imageUrl = file
        ? await this.fileUploadService.handleUpload(file)
        : dto.imageUrl;

      const created = new this.pageModel({ ...dto, imageUrl });
      return await created.save();
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new BadRequestException('Page with this key already exists');
      }
      throw new InternalServerErrorException('Failed to create page');
    }
  }

  async findAll(): Promise<Page[]> {
    // only three keys expected, but allow list for admin UIs
    return this.pageModel.find().lean();
  }

  async findOne(id: string): Promise<Page> {
    const page = await this.pageModel.findById(id).lean();
    if (!page) throw new NotFoundException(`Page with ID ${id} not found`);
    return page;
  }

  async findByKey(key: PageKey): Promise<Page> {
    const page = await this.pageModel.findOne({ key }).lean();
    if (!page) throw new NotFoundException(`Page with key "${key}" not found`);
    return page;
  }

  async update(
    id: string,
    dto: UpdatePageDto,
    file?: Express.Multer.File,
  ): Promise<Page> {
    const existing = await this.pageModel.findById(id);
    if (!existing) throw new NotFoundException(`Page with ID ${id} not found`);

    try {
      let imageUrl = dto.imageUrl ?? existing.imageUrl;

      if (file) {
        if (existing.imageUrl) {
          await this.fileUploadService.deleteFile(existing.imageUrl);
        }
        imageUrl = await this.fileUploadService.handleUpload(file);
      }

      const updated = await this.pageModel.findByIdAndUpdate(
        id,
        { ...dto, imageUrl },
        { new: true },
      );

      if (!updated) {
        throw new NotFoundException(`Page with ID ${id} not found`);
      }

      return updated;
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new BadRequestException('Page with this key already exists');
      }
      throw new InternalServerErrorException('Failed to update page');
    }
  }

  async upsertByKey(
    key: PageKey,
    dto: Omit<UpdatePageDto, 'key'>,
    file?: Express.Multer.File,
  ): Promise<Page> {
    const existing = await this.pageModel.findOne({ key });
  
    let imageUrl = dto.imageUrl ?? existing?.imageUrl;
  
    if (file) {
      if (existing?.imageUrl) {
        await this.fileUploadService.deleteFile(existing.imageUrl);
      }
      imageUrl = await this.fileUploadService.handleUpload(file);
    }
  
    // upsert = create if missing, update if exists
    const updated = await this.pageModel.findOneAndUpdate(
      { key },
      { $set: { ...dto, key, imageUrl } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  
    return updated;
  }

  async remove(id: string): Promise<void> {
    const page = await this.pageModel.findById(id);
    if (!page) throw new NotFoundException(`Page with ID ${id} not found`);

    if (page.imageUrl) {
      await this.fileUploadService.deleteFile(page.imageUrl);
    }

    await this.pageModel.findByIdAndDelete(id);
  }
}
