import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  Req,
  UseGuards,
  HttpStatus,
  Headers,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderService } from './order.service';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { UpdateOrderStatusDto } from './dto/update-order.dto';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/enum/user_role.enum';
import { PaymentMethod, PaymentStatus } from 'src/common/enum/payment.enum';
import { CartService } from 'src/modules/cart/cart.service';
import { v4 as uuidv4 } from 'uuid';
import { OrderStatus } from 'src/common/enum/order_status.enum';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrderService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly cartService: CartService,
  ) {}

  @Post()
  async placeOrder(
    @Req() req,
    @Body() createOrderDto: CreateOrderDto,
    @Headers('Idempotency-Key') headerKey: string,
  ) {
    const userId = req.user.userId;

    // Validate payment method - only Stripe is allowed now
    if (createOrderDto.paymentMethod !== PaymentMethod.STRIPE) {
      throw new BadRequestException('Only Stripe payments are accepted');
    }

    // Prioritize header > body > generate
    const idempotencyKey =
      headerKey || createOrderDto.idempotencyKey || uuidv4();
    createOrderDto.idempotencyKey = idempotencyKey;

    // Validate and get cart contents
    const cart = await this.cartService.validateCartForCheckout(userId);

    // Create order with cart items
    const order = await this.ordersService.create(
      userId,
      createOrderDto,
      cart.items.filter((item) => item.product !== null),
    );

    // Create Stripe checkout session 
    const frontendUrl = this.configService.get<string>('BASE_URL');
    const successUrl = `${frontendUrl}/checkout/success?orderId=${order._id}`;
    const cancelUrl = `${frontendUrl}/checkout/cancel?orderId=${order._id}`;

    const session = await this.stripeService.createCheckoutSession({
      orderId: (order._id as string).toString(),
      products: order.products.map((p) => ({
        name: p.name,
        price: p.price,
        quantity: p.quantity,
      })),
      customerEmail: req.user.email,
      successUrl,
      cancelUrl,
    });

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Order placed successfully. Payment required.',
      data: {
        order,
        payment: {
          type: 'stripe',
          sessionId: session.id,
          url: session.url,
        },
      },
    };
  }

  @Get()
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    let orderStatus: OrderStatus | undefined;
    if (status) {
      if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
        throw new BadRequestException(`Invalid status value: ${status}`);
      }
      orderStatus = status as OrderStatus;
    }

    const result = await this.ordersService.findAll(
      page,
      limit,
      search,
      orderStatus,
    );
    return {
      statusCode: 200,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('my-orders')
  async getUserOrders(
    @Req() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const userId = req.user.userId;
    const result = await this.ordersService.getOrdersByUser(
      userId,
      page,
      limit,
    );
    return {
      statusCode: 200,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const order = await this.ordersService.findOne(id);
    return {
      statusCode: 200,
      data: order,
    };
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    // Validate status - remove refunded from allowed statuses
    const allowedStatuses = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ];

    if (!allowedStatuses.includes(updateOrderStatusDto.status)) {
      throw new BadRequestException('Invalid order status');
    }

    const order = await this.ordersService.updateStatus(
      id,
      updateOrderStatusDto,
    );
    return {
      statusCode: 200,
      message: 'Order status updated',
      data: order,
    };
  }

  @Post(':id/retry-payment')
  async retryPayment(@Req() req, @Param('id') orderId: string) {
    const userId = req.user.userId;
    const order = await this.ordersService.findOne(orderId);

    const ownerId =
      (order.user as any)?._id?.toString?.() ?? order.user.toString();
    if (ownerId !== userId) throw new NotFoundException('Order not found');

    if (order.paymentStatus === PaymentStatus.SUCCEEDED) {
      throw new ConflictException('Payment already succeeded');
    }

    const frontendUrl = this.configService.get<string>('BASE_URL');
    const successUrl = `${frontendUrl}/checkout/success?orderId=${order._id}`;
    const cancelUrl = `${frontendUrl}/checkout/cancel?orderId=${order._id}`;

    const session = await this.stripeService.createCheckoutSession({
      orderId: String(order._id),
      products: order.products.map((p) => ({
        name: p.name,
        price: p.price,
        quantity: p.quantity,
      })),
      customerEmail: req.user.email,
      successUrl,
      cancelUrl,
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Payment session created',
      data: {
        sessionId: session.id,
        url: session.url,
      },
    };
  }
}
