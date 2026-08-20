import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BrandService } from './brand.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/enum/user_role.enum';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';

@Controller('brands')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Post()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async create(@Body() dto: CreateBrandDto) {
    const brand = await this.brandService.create(dto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Brand created successfully',
      data: brand,
    };
  }

  @Get()
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const parsedPage = parseInt(page as any, 10);
    const parsedLimit = parseInt(limit as any, 10);

    // Add basic validation for page and limit
    const validatedPage = parsedPage > 0 ? parsedPage : 1;
    const validatedLimit =
      parsedLimit > 0 && parsedLimit <= 100 ? parsedLimit : 10;

    const result = await this.brandService.findAll(
      validatedPage,
      validatedLimit,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Brands fetched successfully',
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const brand = await this.brandService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Brand fetched successfully',
      data: brand,
    };
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateBrandDto) {
    const brand = await this.brandService.update(id, dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Brand updated successfully',
      data: brand,
    };
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async remove(@Param('id') id: string) {
    await this.brandService.remove(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Brand deleted successfully',
    };
  }
}
