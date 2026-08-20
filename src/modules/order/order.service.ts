import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './order.schema';
import { OrderStatus } from 'src/common/enum/order_status.enum';
import { Address } from 'src/modules/address/address.schema';
import { Cart } from 'src/modules/cart/cart.schema';
import { NotificationService } from 'src/modules/notification/notification.service';
import { User } from 'src/modules/users/schema/user.schema';
import { PaymentMethod, PaymentStatus } from 'src/common/enum/payment.enum';
import { v4 as uuidv4 } from 'uuid';
import { UpdateOrderStatusDto } from 'src/modules/order/dto/update-order.dto';
import { Product } from 'src/modules/products/schema/product.schema';
import { ProductAvailability } from 'src/common/enum/product-availability.enum';
import { PopulatedOrderProduct } from 'src/modules/order/types/populatedOrderProduct.types';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(Address.name) private readonly addressModel: Model<Address>,
    @InjectModel(Cart.name) private readonly cartModel: Model<Cart>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    private readonly notificationService: NotificationService,
  ) {}

  async create(userId: string, dto: CreateOrderDto, cartItems: any[]) {
    // Idempotency check
    const existingOrder = await this.orderModel.findOne({
      idempotencyKey: dto.idempotencyKey,
    });
    if (existingOrder) return existingOrder;

    // Validate address
    const address = await this.addressModel.findOne({
      _id: dto.addressId,
      userId,
    });
    if (!address) throw new BadRequestException('Invalid address');

    // Prepare products from cart items
    const products = cartItems.map((item) => {
      const product = item.product!;
      return {
        product: product._id.toString(),
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image:
          Array.isArray(product.images) && product.images.length > 0
            ? product.images[0]
            : '',
      };
    });

    // Calculate totals
    const subtotal = cartItems.reduce(
      (sum, item) => sum + item.product!.price * item.quantity,
      0,
    );
    const total = subtotal;

    // Validate products and stock
    await this.validateProducts(products);

    // Create order - payment status is always PENDING for Stripe
    const order = new this.orderModel({
      user: new Types.ObjectId(userId),
      products,
      address: new Types.ObjectId(dto.addressId),
      paymentMethod: PaymentMethod.STRIPE, // Only Stripe now
      paymentStatus: PaymentStatus.PENDING,
      subtotal,
      total,
      status: OrderStatus.PENDING,
      idempotencyKey: dto.idempotencyKey,
    });

    const savedOrder = await order.save();

    // Update product stock
    await this.updateProductStock(products, 'decrement');

    // Clear cart
    await this.clearUserCart(userId);

    // Send notifications
    await this.notifyOrderCreation(savedOrder, userId);

    return savedOrder;
  }

  private async validateProducts(products: any[]) {
    for (const item of products) {
      const product = await this.productModel.findById(item.product);

      if (!product || product.availability !== ProductAvailability.IN_STOCK) {
        // Notify user: product unavailable during checkout
        await this.notificationService.createNotification({
          title: 'Product Unavailable',
          body: `${item.name} is currently out of stock and cannot be ordered.`,
          user: product?.user?.toString?.() ?? '', // User not available, fallback empty
          metadata: { productId: item.product },
        });

        throw new ConflictException(`Product ${item.name} is out of stock`);
      }

      if (product.stock < item.quantity) {
        // Notify user: insufficient stock
        await this.notificationService.createNotification({
          title: 'Insufficient Stock',
          body: `Only ${product.stock} units of ${item.name} are available.`,
          user: product?.user?.toString?.() ?? '',
          metadata: { productId: item.product },
        });

        throw new ConflictException(
          `Insufficient stock for ${item.name}. Available: ${product.stock}`,
        );
      }
    }
  }

  private async updateProductStock(
    products: any[],
    operation: 'decrement' | 'increment',
  ) {
    for (const item of products) {
      const update =
        operation === 'decrement'
          ? { $inc: { stock: -item.quantity } }
          : { $inc: { stock: item.quantity } };

      const updatedProduct = await this.productModel.findByIdAndUpdate(
        item.product,
        update,
        { new: true },
      );

      if (updatedProduct) {
        const availability =
          updatedProduct.stock > 0
            ? ProductAvailability.IN_STOCK
            : ProductAvailability.OUT_OF_STOCK;

        await this.productModel.findByIdAndUpdate(item.product, {
          availability,
        });

        //  Notify admins when product goes out of stock
        if (availability === ProductAvailability.OUT_OF_STOCK) {
          const admins = await this.userModel.find({ role: 'admin' }).exec();
          await Promise.all(
            admins.map((admin) =>
              this.notificationService.createNotification({
                title: 'Product Out of Stock',
                body: `${updatedProduct.name} is now out of stock.`,
                user: admin._id.toString(),
                metadata: { productId: updatedProduct._id },
              }),
            ),
          );
        }
      }
    }
  }

  private async clearUserCart(userId: string) {
    try {
      await this.cartModel.deleteOne({ user: new Types.ObjectId(userId) });
    } catch (error) {
      this.logger.error(`Failed to clear cart for user ${userId}:`, error.message);
    }
  }

  private async notifyOrderCreation(order: Order, userId: string) {
    // Notify user
    await this.notificationService.createNotification({
      title: 'Order Placed',
      body: `Your order #${order._id} has been placed successfully`,
      user: userId,
      metadata: { orderId: order._id, status: OrderStatus.PENDING },
    });

    // Notify admins
    const admins = await this.userModel.find({ role: 'admin' }).exec();
    await Promise.all(
      admins.map((admin) =>
        this.notificationService.createNotification({
          title: 'New Order Placed',
          body: `Order #${order._id} placed by user ${userId}`,
          user: admin.id.toString(),
          metadata: { orderId: order._id, userId },
        }),
      ),
    );
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string,
    status?: OrderStatus,
    userId?: string,
  ) {
    const query: any = {};
    if (status) query.status = status;
    if (userId) query.user = new Types.ObjectId(userId);
    if (search && search.trim() !== '') {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // If search looks like ObjectId or UUID, try matching _id directly
      const isObjectId = Types.ObjectId.isValid(search);
      const idMatch = isObjectId ? [{ _id: new Types.ObjectId(search) }] : [];

      query.$or = [
        ...idMatch,
        { 'user.firstName': { $regex: escaped, $options: 'i' } },
        { 'user.lastName': { $regex: escaped, $options: 'i' } },
        { 'user.email': { $regex: escaped, $options: 'i' } },
        { 'products.name': { $regex: escaped, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.orderModel
        .find(query)
        .skip(skip)
        .limit(limit)
        .populate([
          {
            path: 'user',
            select: 'firstName lastName email imageUrl',
          },
          {
            path: 'address',
            select:
              'streetNo city state postalCode country type recipientFirstName recipientLastName recipientEmail',
          },
          {
            path: 'products.product',
            select: 'name price stock images availability',
          },
        ])
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
      this.orderModel.countDocuments(query),
    ]);

    // --- Format response ---
    const formattedOrders = orders.map((order) => ({
      ...order,
      products: (order.products as any[]).map((item: any) => {
        const isPopulated =
          item.product &&
          typeof item.product === 'object' &&
          '_id' in item.product;

        const productData = isPopulated ? item.product : null;

        return {
          orderLineId: item._id, // subdocument ID
          quantity: item.quantity,
          snapshot: {
            name: item.name,
            price: item.price,
            image: item.image,
          },
          product: productData
            ? {
                id: productData._id,
                name: productData.name,
                price: productData.price,
                stock: productData.stock,
                images: productData.images,
                availability: productData.availability,
              }
            : null,
        };
      }),
    }));

    return {
      data: formattedOrders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<any> {
    const order = await this.orderModel
      .findById(id)
      .populate([
        {
          path: 'user',
          select: 'firstName lastName email imageUrl',
        },
        {
          path: 'address',
          select:
            'streetNo city state postalCode country type recipientFirstName recipientLastName recipientEmail',
        },
        {
          path: 'products.product',
          select: 'name price stock images availability',
        },
      ])
      .lean()
      .exec();

    if (!order) throw new NotFoundException('Order not found');

    // --- Format response ---
    return {
      ...order,
      products: (order.products as any[]).map((item: any) => {
        const isPopulated =
          item.product &&
          typeof item.product === 'object' &&
          '_id' in item.product;

        const productData = isPopulated ? item.product : null;

        return {
          orderLineId: item._id,
          quantity: item.quantity,
          snapshot: {
            name: item.name,
            price: item.price,
            image: item.image,
          },
          product: productData
            ? {
                id: productData._id,
                name: productData.name,
                price: productData.price,
                stock: productData.stock,
                images: productData.images,
                availability: productData.availability,
              }
            : null,
        };
      }),
    };
  }

  async updateStatus(
    id: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
  ): Promise<Order> {
    const order = await this.orderModel
      .findByIdAndUpdate(
        id,
        {
          status: updateOrderStatusDto.status,
          trackingNumber: updateOrderStatusDto.trackingNumber,
        },
        { new: true },
      )
      .populate('user', 'firstName lastName email imageUrl');

    if (!order) throw new NotFoundException('Order not found');

    const userIdStr =
      (order.user as any)?._id?.toString?.() ?? order.user.toString();

    // ✅ Basic status update notification
    await this.notificationService.createNotification({
      title: 'Order Status Updated',
      body: `Your order #${order._id} is now "${updateOrderStatusDto.status}".`,
      user: userIdStr,
      metadata: {
        orderId: order._id,
        newStatus: updateOrderStatusDto.status,
        trackingNumber: updateOrderStatusDto.trackingNumber,
      },
    });

    // ✅ Notify user when delivered
    if (updateOrderStatusDto.status === OrderStatus.DELIVERED) {
      await this.notificationService.createNotification({
        title: 'Order Delivered',
        body: `Your order #${order._id} has been delivered successfully.`,
        user: userIdStr,
        metadata: { orderId: order._id },
      });
    }

    //  Notify on cancellation (user)
    if (updateOrderStatusDto.status === OrderStatus.CANCELLED) {
      await this.notificationService.createNotification({
        title: 'Order Cancelled',
        body: `Your order #${order._id} has been cancelled.`,
        user: userIdStr,
        metadata: { orderId: order._id },
      });

      //  Notify all admins
      const admins = await this.userModel.find({ role: 'admin' }).exec();
      await Promise.all(
        admins.map((admin) =>
          this.notificationService.createNotification({
            title: 'Order Cancelled',
            body: `Order #${order._id} has been cancelled.`,
            user: admin._id.toString(),
            metadata: { orderId: order._id, cancelledBy: userIdStr },
          }),
        ),
      );
    }

    return order;
  }

  async updatePaymentStatus(
    orderId: string,
    paymentStatus: PaymentStatus,
    stripePaymentIntentId?: string,
  ) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    order.paymentStatus = paymentStatus;
    if (stripePaymentIntentId) {
      order.stripePaymentIntentId = stripePaymentIntentId;
    }

    //   Update order status based on payment result
    if (paymentStatus === PaymentStatus.SUCCEEDED) {
      order.status = OrderStatus.PENDING;
    } else if (paymentStatus === PaymentStatus.FAILED) {
      order.status = OrderStatus.CANCELLED;

      //   Restore stock when payment fails
      await this.updateProductStock(order.products, 'increment');
    }

    await order.save();

    const userId = order.user.toString();

    //   Notify user: payment succeeded
    if (paymentStatus === PaymentStatus.SUCCEEDED) {
      await this.notificationService.createNotification({
        title: 'Payment Successful',
        body: `Payment for order #${order._id} has been completed.`,
        user: userId,
        metadata: { orderId: order._id },
      });
    }

    //   Notify user: payment failed
    if (paymentStatus === PaymentStatus.FAILED) {
      await this.notificationService.createNotification({
        title: 'Payment Failed',
        body: `Payment for order #${order._id} failed. Your items have been returned to your cart.`,
        user: userId,
        metadata: { orderId: order._id },
      });

      //   Notify admins (optional)
      const admins = await this.userModel.find({ role: 'admin' }).exec();
      await Promise.all(
        admins.map((admin) =>
          this.notificationService.createNotification({
            title: 'Payment Failed',
            body: `Payment for order #${order._id} failed.`,
            user: admin._id.toString(),
            metadata: { orderId: order._id, userId },
          }),
        ),
      );
    }

    return order;
  }

  async getOrdersByUser(userId: string, page = 1, limit = 10) {
    return this.findAll(page, limit, undefined, undefined, userId);
  }
}
