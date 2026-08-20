import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UploadedFiles,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { UseGlobalFileInterceptor } from 'src/common/decorator/globalFileInterceptor.decorator';
import { BlogService } from 'src/modules/cms/blog/blog.service';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/enum/user_role.enum';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';

@Controller('blogs')
export class BlogController {
  constructor(private readonly blogsService: BlogService) {}

  @Post()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseGlobalFileInterceptor({ fieldName: 'images', maxCount: 5 })
  async create(
    @Body() createBlogDto: CreateBlogDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const blog = await this.blogsService.create(createBlogDto, files);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Blog created successfully',
      data: blog,
    };
  }

  @Get()
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    const validatedPage = page > 0 ? page : 1;
    const validatedLimit = limit > 0 && limit <= 100 ? limit : 10;
    const result = await this.blogsService.findAll(
      validatedPage,
      validatedLimit,
      search,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Blogs fetched successfully',
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        ...(search && { search }),
      },
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const blog = await this.blogsService.findOne(id);
    return {
      statusCode: HttpStatus.FOUND,
      message: 'Blog fetched successfully',
      data: blog,
    };
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseGlobalFileInterceptor({ fieldName: 'images', maxCount: 5 })
  async update(
    @Param('id') id: string,
    @Body() updateBlogDto: UpdateBlogDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const updated = await this.blogsService.update(id, updateBlogDto, files);
    return {
      statusCode: HttpStatus.OK,
      message: 'Blog updated successfully',
      data: updated,
    };
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async remove(@Param('id') id: string) {
    await this.blogsService.remove(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Blog deleted successfully',
    };
  }
}
