import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart } from './cart.schema';
import { AddToCartDto } from './dto/create-cart.dto';
import { ProductAvailability } from 'src/common/enum/product-availability.enum';
import { Product } from 'src/modules/products/schema/product.schema';
import PopulatedProduct from 'src/common/interface/populate-product.interface';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<Cart>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
  ) {}

  async addToCart(userId: string, dto: AddToCartDto) {
    // Validate product availability
    const product = await this.productModel.findById(dto.productId);
    if (!product || product.availability !== ProductAvailability.IN_STOCK) {
      throw new NotFoundException('Product not available');
    }

    let cart = await this.cartModel.findOne({
      user: new Types.ObjectId(userId),
    });

    if (!cart) {
      cart = new this.cartModel({
        user: new Types.ObjectId(userId),
        items: [],
      });
    }

    const existingItemIndex = cart.items.findIndex(
      (item) => item.product.toString() === dto.productId,
    );

    if (existingItemIndex > -1) {
      const newQuantity = cart.items[existingItemIndex].quantity + dto.quantity;
      if (newQuantity > 50) {
        throw new ConflictException('Maximum quantity per product is 50');
      }
      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      if (cart.items.length >= 100) {
        throw new ConflictException('Cart cannot contain more than 100 items');
      }
      cart.items.push({
        product: new Types.ObjectId(dto.productId),
        quantity: dto.quantity,
      });
    }
    const savedCart = await cart.save();
    return savedCart;
  }

  async getCart(userId: string) {
    const cart = await this.cartModel
      .findOne({ user: new Types.ObjectId(userId) })
      .populate<{ items: { product: PopulatedProduct | null; quantity: number }[] }>(
        'items.product',
        'name price images availability',
      )
      .lean();

    if (!cart) return { items: [] };

    // Filter out unavailable or non-existent products
    const availableItems = cart.items.filter((item) => {
      if (!item.product) return false; // Skip if product is null/undefined
      return item.product.availability === ProductAvailability.IN_STOCK;
    });

    // Update cart if some items were unavailable
    if (availableItems.length !== cart.items.length) {
      await this.cartModel.updateOne(
        { _id: cart._id },
        {
          items: availableItems.map((item) => ({
            product: (item.product as PopulatedProduct)._id,
            quantity: item.quantity,
          })),
        },
      );
    }

    return { ...cart, items: availableItems };
  }

  async updateCartItem(userId: string, productId: string, quantity: number) {
    if (quantity < 1 || quantity > 50) {
      throw new ConflictException('Quantity must be between 1 and 50');
    }

    const cart = await this.cartModel.findOne({
      user: new Types.ObjectId(userId),
    });
    if (!cart) throw new NotFoundException('Cart not found');

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId,
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = quantity;
      return cart.save();
    }

    throw new NotFoundException('Product not found in cart');
  }

  async removeCartItem(userId: string, productId: string) {
    const cart = await this.cartModel.findOne({
      user: new Types.ObjectId(userId),
    });
    if (!cart) throw new NotFoundException('Cart not found');

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId,
    );

    return cart.save();
  }

  async clearCart(userId: string) {
    await this.cartModel.deleteOne({ user: new Types.ObjectId(userId) });
    return { message: 'Cart cleared successfully' };
  }

  async validateCartForCheckout(userId: string) {
    const cart = await this.cartModel
      .findOne({ user: new Types.ObjectId(userId) })
      .populate<{ items: { product: PopulatedProduct | null; quantity: number }[] }>(
        'items.product',
        'name price availability stock',
      )
      .exec();

    if (!cart || cart.items.length === 0) {
      throw new NotFoundException('Cart is empty');
    }

    // Check stock availability
    const outOfStockItems: string[] = [];
    const invalidItems: string[] = [];
    
    for (const item of cart.items) {
      if (!item.product) {
        invalidItems.push('Unknown product');
        continue;
      }

      const product = item.product;
      
      if (product.availability !== ProductAvailability.IN_STOCK) {
        outOfStockItems.push(product.name || 'Unknown product');
      }
      
      if (product.stock < item.quantity) {
        throw new ConflictException(
          `Insufficient stock for ${product.name || 'a product'}. Only ${product.stock} available`,
        );
      }
    }

    if (invalidItems.length > 0) {
      throw new NotFoundException(
        `Some products in your cart are no longer available: ${invalidItems.join(', ')}`
      );
    }

    if (outOfStockItems.length > 0) {
      throw new ConflictException(
        `Products out of stock: ${outOfStockItems.join(', ')}`,
      );
    }

    return cart;
  }
}
