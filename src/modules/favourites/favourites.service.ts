import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  FavouriteProduct,
  FavouriteProductDocument,
} from './schema/favourite-product.schema';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';
import {
  FavouritesListResponseDto,
  FavouriteStatusResponseDto,
} from './dto/favourite-response.dto';

@Injectable()
export class FavouritesService {
  private readonly logger = new Logger(FavouritesService.name);

  constructor(
    @InjectModel(FavouriteProduct.name)
    private readonly favouriteModel: Model<FavouriteProductDocument>,
    @Inject('PRODUCTS_SERVICE')
    private readonly productsService: ProductsService,
    private readonly usersService: UsersService,
  ) {}

  // --- Validate IDs ---
  private validateObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
  }

  // --- Check if product exists ---
  private async validateProductExists(productId: string): Promise<void> {
    try {
      await this.productsService.findOne(productId);
    } catch (error) {
      throw new NotFoundException('Product not found');
    }
  }

  // --- Check if user exists ---
  private async validateUserExists(userId: string): Promise<void> {
    try {
      await this.usersService.findById(userId);
    } catch (error) {
      throw new NotFoundException('User not found');
    }
  }

  // --- Add to favourites ---
  async addToFavourites(
    userId: string,
    productId: string,
  ): Promise<FavouriteProduct> {
    this.validateObjectId(userId);
    this.validateObjectId(productId);

    await Promise.all([
      this.validateUserExists(userId),
      this.validateProductExists(productId),
    ]);

    try {
      const favourite = await this.favouriteModel.create({
        user: new Types.ObjectId(userId),
        product: new Types.ObjectId(productId),
      });

      // Populate if needed
      const populated = await this.favouriteModel
        .findById(favourite._id)
        .populate('product')
        .lean()
        .exec();

      return populated as unknown as FavouriteProduct;
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException(
          'This product is already in your favourites',
        );
      }
      throw error;
    }
  }

  // --- Remove from favourites ---
  async removeFromFavourites(userId: string, productId: string): Promise<void> {
    this.validateObjectId(userId);
    this.validateObjectId(productId);

    const result = await this.favouriteModel
      .findOneAndDelete({
        user: new Types.ObjectId(userId),
        product: new Types.ObjectId(productId),
      })
      .exec();

    if (!result) {
      throw new NotFoundException('Favourite product not found');
    }

    this.logger.log(
      `Product ${productId} removed from favourites for user ${userId}`,
    );
  }

  // --- Toggle favourite status ---
  async toggleFavourite(
    userId: string,
    productId: string,
    isFavourite: boolean,
  ): Promise<{ message: string; favourite?: FavouriteProduct }> {
    if (isFavourite) {
      const favourite = await this.addToFavourites(userId, productId);
      return {
        message: 'Product added to favourites',
        favourite,
      };
    } else {
      await this.removeFromFavourites(userId, productId);
      return {
        message: 'Product removed from favourites',
      };
    }
  }

  async getUserFavourites(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<FavouritesListResponseDto> {
    this.validateObjectId(userId);
    await this.validateUserExists(userId);

    const skip = (page - 1) * limit;

    try {
      const [favourites, total] = await Promise.all([
        this.favouriteModel
          .find({ user: new Types.ObjectId(userId) })
          .populate({
            path: 'product',
            populate: [
              { path: 'category', select: 'name' },
              { path: 'brand', select: 'name' },
              { path: 'procedure', select: 'name' },
            ],
          })
          .sort({ addedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean() // Convert to plain JS objects
          .exec(),
        this.favouriteModel.countDocuments({
          user: new Types.ObjectId(userId),
        }),
      ]);

      // Transform to DTOs
      const favouriteDtos = favourites.map((doc: any) => ({
        id: doc._id.toString(),
        product: doc.product,
        addedAt: doc.createdAt || doc.addedAt,
        user: doc.user.toString(),
      }));

      return {
        favourites: favouriteDtos,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(
        `Error getting favourites: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // --- Check if product is in user's favourites ---
  async isProductInFavourites(
    userId: string,
    productId: string,
  ): Promise<FavouriteStatusResponseDto> {
    this.validateObjectId(userId);
    this.validateObjectId(productId);

    const favourite = await this.favouriteModel
      .findOne({
        user: new Types.ObjectId(userId),
        product: new Types.ObjectId(productId),
      })
      .lean()
      .exec();

    return {
      isFavourite: !!favourite,
      favouriteId: favourite?._id?.toString(),
    };
  }

  // --- Get favourites count ---
  async getFavouritesCount(userId: string): Promise<number> {
    this.validateObjectId(userId);
    await this.validateUserExists(userId);

    return await this.favouriteModel
      .countDocuments({ user: new Types.ObjectId(userId) })
      .exec();
  }

  // --- Get multiple products favourite status ---
  async getBulkFavouriteStatus(
    userId: string,
    productIds: string[],
  ): Promise<Record<string, boolean>> {
    this.validateObjectId(userId);
    await this.validateUserExists(userId);

    // Validate all product IDs
    productIds.forEach((id) => this.validateObjectId(id));

    const favourites = await this.favouriteModel
      .find({
        user: new Types.ObjectId(userId),
        product: { $in: productIds.map((id) => new Types.ObjectId(id)) },
      })
      .select('product')
      .exec();

    const favouriteMap = favourites.reduce(
      (acc, fav) => {
        acc[fav.product.toString()] = true;
        return acc;
      },
      {} as Record<string, boolean>,
    );

    // Create result with all product IDs
    const result: Record<string, boolean> = {};
    productIds.forEach((id) => {
      result[id] = !!favouriteMap[id];
    });

    return result;
  }

  // --- Remove all favourites for a user (on account deletion) ---
  async removeAllUserFavourites(userId: string): Promise<void> {
    this.validateObjectId(userId);

    const result = await this.favouriteModel
      .deleteMany({ user: new Types.ObjectId(userId) })
      .exec();

    this.logger.log(
      `Removed ${result.deletedCount} favourites for user ${userId}`,
    );
  }

  // --- Remove favourite by ID (admin function) ---
  async removeFavouriteById(favouriteId: string): Promise<void> {
    this.validateObjectId(favouriteId);

    const result = await this.favouriteModel
      .findByIdAndDelete(favouriteId)
      .exec();

    if (!result) {
      throw new NotFoundException('Favourite not found');
    }

    this.logger.log(`Favourite ${favouriteId} removed`);
  }

  // --- Get all favourites (admin function) ---
  async getAllFavourites(
    page: number = 1,
    limit: number = 10,
    userId?: string,
    productId?: string,
  ): Promise<FavouritesListResponseDto> {
    const query: any = {};
    if (userId) {
      query.user = new Types.ObjectId(userId);
    }
    if (productId) {
      query.product = new Types.ObjectId(productId);
    }

    const [favourites, total] = await Promise.all([
      this.favouriteModel
        .find(query)
        .populate('product user')
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.favouriteModel.countDocuments(query),
    ]);

    // Transform to DTOs
    const favouriteDtos = favourites.map((doc: any) => ({
      id: doc._id.toString(),
      product: doc.product,
      addedAt: doc.createdAt || doc.addedAt,
      user: doc.user.toString(),
    }));

    return {
      favourites: favouriteDtos,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
