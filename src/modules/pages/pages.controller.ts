import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UploadedFile,
  HttpStatus,
  UseGuards,
  Query,
  Put,
  ParseEnumPipe,
} from '@nestjs/common';
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { UseGlobalFileInterceptor } from '../../common/decorator/globalFileInterceptor.decorator';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/enum/user_role.enum';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { PageKey } from './enum/page-key.enum';

@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  // ADMIN: create a page (one of terms/privacy/about)
  @Post()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseGlobalFileInterceptor({ fieldName: 'image' })
  async create(
    @Body() dto: CreatePageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const page = await this.pagesService.create(dto, file);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Page created successfully',
      data: page,
    };
  }

  // PUBLIC: get by key quickly (e.g., /pages/by-key/terms)
  @Get('by-key/:key')
  async getByKey(@Param('key') key: PageKey) {
    const page = await this.pagesService.findByKey(key);
    return {
      statusCode: HttpStatus.OK,
      message: 'Page fetched successfully',
      data: page,
    };
  }

  // PUBLIC: list (useful for admin UI too)
  @Get()
  async findAll(@Query('key') key?: PageKey) {
    if (key) {
      const page = await this.pagesService.findByKey(key);
      return {
        statusCode: HttpStatus.OK,
        message: 'Page fetched successfully',
        data: page,
      };
    }
    const pages = await this.pagesService.findAll();
    return {
      statusCode: HttpStatus.OK,
      message: 'Pages fetched successfully',
      data: pages,
    };
  }

  // ADMIN/INTERNAL: get by id
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const page = await this.pagesService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Page fetched successfully',
      data: page,
    };
  }

  // ADMIN: update by id
  @Patch(':id')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseGlobalFileInterceptor({ fieldName: 'image' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const updated = await this.pagesService.update(id, dto, file);
    return {
      statusCode: HttpStatus.OK,
      message: 'Page updated successfully',
      data: updated,
    };
  }

  // ADMIN: Save (upsert) by key → preferred for dashboard
  @Put('by-key/:key')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseGlobalFileInterceptor({ fieldName: 'image' })
  async upsertByKey(
    @Param('key', new ParseEnumPipe(PageKey)) key: PageKey,
    @Body() dto: UpdatePageDto, // no 'key' in body; key comes from URL
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const page = await this.pagesService.upsertByKey(key, dto, file);
    return {
      statusCode: HttpStatus.OK,
      message: 'Page saved successfully',
      data: page,
    };
  }

  // ADMIN: delete by id
  @Delete(':id')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async remove(@Param('id') id: string) {
    await this.pagesService.remove(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Page deleted successfully',
    };
  }
}
