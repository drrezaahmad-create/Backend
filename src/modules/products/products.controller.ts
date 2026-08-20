import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFiles,
  Request,
  NotFoundException,
  BadRequestException,
  ParseIntPipe,
  HttpStatus,
  DefaultValuePipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { GetProductsDto } from './dto/get-products.dto';
import { ProductAvailability } from 'src/common/enum/product-availability.enum';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/enum/user_role.enum';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { GlobalFileUploadInterceptor } from 'src/modules/file-upload/file-upload.interceptor';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseInterceptors(
    GlobalFileUploadInterceptor({
      fieldName: 'images',
      maxCount: 10,
      allowedMimes: /^(image\/(jpeg|png|gif|webp)|application\/pdf)$/i,
      maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
    }),
  )
  async create(
    @Body() createProductDto: CreateProductDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const product = await this.productsService.create(createProductDto, files);
    return {
      status: 'success',
      statusCode: HttpStatus.CREATED,
      message: 'Product created successfully',
      data: product,
    };
  }

  @Get()
  async findAll(
    @Query() query: GetProductsDto,
    @Request() req?: any,
  ) {
    // Validate price range
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      throw new BadRequestException('minPrice cannot be greater than maxPrice');
    }

    const userId = req?.user?.id;
    const result = await this.productsService.findAll(query, userId);

    return {
      status: 'success',
      statusCode: HttpStatus.OK,
      message: 'Products fetched successfully',
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  @Get('hot')
  async getHotSellingProducts(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('days') days?: number,
    @Request() req?: any,
  ) {
    if (limit > 50) {
      throw new BadRequestException('Limit cannot exceed 50');
    }
    const userId = req?.user?.id;
    const products = await this.productsService.getHotSellingProducts(
      limit,
      days,
      userId,
    );
    return {
      status: 'success',
      statusCode: HttpStatus.OK,
      message: 'Hot selling products fetched successfully',
      data: products,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req?: any) {
    const userId = req?.user?.id;
    const product = await this.productsService.findOne(id, userId);
    return {
      status: 'success',
      statusCode: HttpStatus.OK,
      message: 'Product fetched successfully',
      data: product,
    };
  }

  @Get('byid/:productId')
  async findOneByProductId(
    @Param('productId') productId: string,
    @Query('includePrivate') includePrivate?: string,
    @Request() req?: any,
  ) {
    const userId = req?.user?.id;
    const product = await this.productsService.findOneByProductId(
      productId,
      userId,
      includePrivate === 'true',
    );
    return {
      status: 'success',
      statusCode: HttpStatus.OK,
      message: 'Product fetched successfully',
      data: product,
    };
  }

  @Patch(':id')
  @UseInterceptors(
    GlobalFileUploadInterceptor({
      fieldName: 'images',
      maxCount: 10,
      allowedMimes: /^(image\/(jpeg|png|gif|webp)|application\/pdf)$/i,
      maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
    }),
  )
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    // Parse images array if frontend sent JSON string of existing URLs
    if (dto.images && typeof dto.images === 'string') {
      try {
        dto.images = JSON.parse(dto.images);
      } catch {
        throw new BadRequestException(
          'Invalid images format — must be a JSON array of URLs.',
        );
      }
    }

    const updated = await this.productsService.updateSimple(id, dto, files);

    return {
      status: 'success',
      statusCode: HttpStatus.OK,
      message: 'Product updated successfully',
      data: updated,
    };
  }

  @Patch(':id/stock')
  async updateStock(
    @Param('id') id: string,
    @Body('stock', ParseIntPipe) stock: number,
  ) {
    if (stock < 0) {
      throw new BadRequestException('Stock cannot be negative');
    }
    const updated = await this.productsService.updateStock(id, stock);
    return {
      status: 'success',
      statusCode: HttpStatus.OK,
      message: 'Stock updated successfully',
      data: updated,
    };
  }

  @Patch(':id/sales')
  async incrementSales(
    @Param('id') id: string,
    @Body('quantity', new DefaultValuePipe(1), ParseIntPipe) quantity: number,
  ) {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }
    const updated = await this.productsService.incrementSales(id, quantity);
    return {
      status: 'success',
      statusCode: HttpStatus.OK,
      message: 'Sales incremented successfully',
      data: updated,
    };
  }

  @Patch(':id/featured')
  async toggleFeatured(@Param('id') id: string) {
    const updated = await this.productsService.toggleFeatured(id);
    return {
      status: 'success',
      statusCode: HttpStatus.OK,
      message: 'Product featured status toggled',
      data: updated,
    };
  }

  @Patch(':id/toggle-publish')
  async togglePublish(@Param('id') id: string) {
    const updated = await this.productsService.togglePublish(id);
    return {
      status: 'success',
      statusCode: HttpStatus.OK,
      message: 'Product publish status toggled',
      data: updated,
    };
  }

  @Get('featured')
  async getFeaturedProducts(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    if (limit > 50) {
      throw new BadRequestException('Limit cannot exceed 50');
    }
    const items = await this.productsService.getFeaturedProducts(limit);
    return {
      status: 'success',
      statusCode: HttpStatus.OK,
      message: 'Featured products fetched successfully',
      data: items,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.productsService.remove(id);
    return {
      status: 'success',
      statusCode: HttpStatus.OK,
      message: 'Product deleted successfully',
    };
  }

  @Get('analytics/sales')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getSalesAnalytics(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    if (days > 365) {
      throw new BadRequestException('Date range cannot exceed 365 days');
    }
    if (limit > 100) {
      throw new BadRequestException('Limit cannot exceed 100');
    }
    const analytics = await this.productsService.getSalesAnalytics(days, limit);
    return {
      status: 'success',
      statusCode: HttpStatus.OK,
      message: 'Sales analytics fetched successfully',
      data: analytics,
    };
  }

  @Get(':id/related')
  async getRelatedProducts(
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number,
    @Request() req?: any,
  ) {
    if (limit > 20) {
      throw new BadRequestException('Limit cannot exceed 20');
    }
    const userId = req?.user?.id;
    const products = await this.productsService.getRelatedProducts(
      id,
      limit,
      userId,
    );
    return {
      status: 'success',
      statusCode: HttpStatus.OK,
      message: 'Related products fetched successfully',
      data: products,
    };
  }

  @Get(':id/frequently-bought-together')
  async getFrequentlyBoughtTogether(
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(4), ParseIntPipe) limit: number,
    @Request() req?: any,
  ) {
    if (limit > 10) {
      throw new BadRequestException('Limit cannot exceed 10');
    }
    const userId = req?.user?.id;
    const products = await this.productsService.getFrequentlyBoughtTogether(
      id,
      limit,
      userId,
    );
    return {
      status: 'success',
      statusCode: HttpStatus.OK,
      message: 'Frequently bought together products fetched successfully',
      data: products,
    };
  }
}
