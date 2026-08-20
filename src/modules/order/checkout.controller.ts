import { Controller, Get, NotFoundException, Query, Req } from '@nestjs/common';
import { OrderService } from './order.service';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { UseGuards } from '@nestjs/common/decorators';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly ordersService: OrderService) {}

  @Get('success')
  @UseGuards(JwtAuthGuard)
  async success(@Req() req, @Query('orderId') orderId: string) {
    const userId = req.user.userId;
    const order = await this.ordersService.findOne(orderId);

    // Handle both populated user object and user ID string
    const orderUserId =
      (order.user as any)?._id?.toString?.() ?? order.user.toString();

    if (orderUserId !== userId) {
      throw new NotFoundException('Order not found');
    }

    return {
      statusCode: 200,
      message: 'Payment succeeded!',
      data: order,
    };
  }

  @Get('cancel')
  @UseGuards(JwtAuthGuard)
  async cancel(@Req() req, @Query('orderId') orderId: string) {
    const userId = req.user.userId;
    const order = await this.ordersService.findOne(orderId);

    // Handle both populated user object and user ID string
    const orderUserId =
      (order.user as any)?._id?.toString?.() ?? order.user.toString();

    if (orderUserId !== userId) {
      throw new NotFoundException('Order not found');
    }

    return {
      statusCode: 200,
      message: 'Payment was canceled.',
      data: order,
    };
  }
}
