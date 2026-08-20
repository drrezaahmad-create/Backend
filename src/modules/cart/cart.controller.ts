import {
  Controller,
  Post,
  Body,
  Delete,
  Get,
  Patch,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { AddToCartDto } from './dto/create-cart.dto';
import { UpdateCartItemDto } from 'src/modules/cart/dto/update-cart.dto';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post('add')
  async addToCart(@Req() req, @Body() addToCartDto: AddToCartDto) {
    const userId = req.user.userId;
    const cart = await this.cartService.addToCart(userId, addToCartDto);
    return {
      statusCode: 200,
      message: 'Product added to cart',
      data: cart,
    };
  }

  @Get()
  async getCart(@Req() req) {
    const userId = req.user.userId;
    const cart = await this.cartService.getCart(userId);
    return { statusCode: 200, data: cart };
  }

  @Patch('item/:productId')
  async updateCartItem(
    @Req() req,
    @Param('productId') productId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    const userId = req.user.userId;
    const cart = await this.cartService.updateCartItem(
      userId,
      productId,
      updateCartItemDto.quantity,
    );
    return {
      statusCode: 200,
      message: 'Cart updated',
      data: cart,
    };
  }

  @Delete('item/:productId')
  async removeCartItem(@Req() req, @Param('productId') productId: string) {
    const userId = req.user.userId;
    const cart = await this.cartService.removeCartItem(userId, productId);
    return {
      statusCode: 200,
      message: 'Product removed from cart',
      data: cart,
    };
  }

  @Delete('clear')
  async clearCart(@Req() req) {
    const userId = req.user.userId;
    await this.cartService.clearCart(userId);
    return {
      statusCode: 200,
      message: 'Cart cleared successfully',
    };
  }
}
