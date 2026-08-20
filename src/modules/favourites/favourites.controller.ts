// src/modules/favourites/favourites.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FavouritesService } from './favourites.service';
import { ToggleFavouriteDto } from './dto/toggle-favourite.dto';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/enum/user_role.enum';

@Controller('favourites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FavouritesController {
  constructor(private readonly favouritesService: FavouritesService) {}

  @Post('toggle')
  async toggleFavourite(
    @Request() req,
    @Body() toggleFavouriteDto: ToggleFavouriteDto,
  ) {
    return await this.favouritesService.toggleFavourite(
      req.user.userId,
      toggleFavouriteDto.productId,
      toggleFavouriteDto.isFavourite,
    );
  }

  @Post('add/:productId')
  async addToFavourite(@Request() req, @Param('productId') productId: string) {
    return await this.favouritesService.addToFavourites(req.user.userId, productId);
  }

  @Delete('remove/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFromFavourite(
    @Request() req,
    @Param('productId') productId: string,
  ) {
    await this.favouritesService.removeFromFavourites(req.user.userId, productId);
  }

  @Get('my-favourites')
  async getUserFavourites(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return await this.favouritesService.getUserFavourites(
      req.user.userId,
      page,
      limit,
    );
  }

  @Get('check/:productId')
  async checkFavourite(@Request() req, @Param('productId') productId: string) {
    return await this.favouritesService.isProductInFavourites(
      req.user.userId,
      productId,
    );
  }

  @Get('count')
  async getFavouritesCount(@Request() req) {
    const count = await this.favouritesService.getFavouritesCount(req.user.userId);
    return { count };
  }

  @Post('bulk-status')
  async getBulkFavouriteStatus(
    @Request() req,
    @Body('productIds') productIds: string[],
  ) {
    return await this.favouritesService.getBulkFavouriteStatus(
      req.user.userId,
      productIds,
    );
  }

  // --- Admin Endpoints ---

  @Get('admin/all')
  @Roles(Role.ADMIN)
  async getAllFavourites(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    @Query('userId') userId?: string,
    @Query('productId') productId?: string,
  ) {
    return await this.favouritesService.getAllFavourites(
      page,
      limit,
      userId,
      productId,
    );
  }

  @Delete('admin/:favouriteId')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFavouriteById(@Param('favouriteId') favouriteId: string) {
    await this.favouritesService.removeFavouriteById(favouriteId);
  }
}
