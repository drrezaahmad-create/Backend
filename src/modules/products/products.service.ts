import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpStatus,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { GetProductsDto } from './dto/get-products.dto';
import { FileUploadService } from 'src/modules/file-upload/file-upload.service';
import { ProductAvailability } from 'src/common/enum/product-availability.enum';
import { Product, ProductDocument } from './schema/product.schema';
import { FavouritesService } from '../favourites/favourites.service';
import { NotificationService } from 'src/modules/notification/notification.service';

@Injectable()
export class ProductsService implements OnModuleInit {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly fileUploadService: FileUploadService,
    private readonly favouritesService: FavouritesService,
    private readonly notificationService: NotificationService,  
  ) {}

  async onModuleInit() {
    try {
      await this.productModel.updateMany(
        { isPublished: { $exists: false } },
        { $set: { isPublished: true } },
      );
    } catch (error) {
      this.logger.warn(`Failed to run isPublished migration: ${error.message}`);
    }
  }

  // --- Process multiple product image files ---
  private async processAndUploadImageFiles(
    files: Express.Multer.File[],
  ): Promise<string[]> {
    if (!files || files.length === 0) {
      return [];
    }

    // Validate file types and sizes
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];
    const maxFileSize = 5 * 1024 * 1024; // 5MB

    for (const file of files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type: ${file.mimetype}. Allowed types: ${allowedMimeTypes.join(', ')}`,
        );
      }
      if (file.size > maxFileSize) {
        throw new BadRequestException(
          `File ${file.originalname} exceeds maximum size of 5MB`,
        );
      }
    }

    // Upload all files and get URLs
    const uploadPromises = files.map((file) =>
      this.fileUploadService.handleUpload(file),
    );

    return await Promise.all(uploadPromises);
  }

  // --- Update product availability based on stock ---
  private updateAvailabilityBasedOnStock(stock: number): ProductAvailability {
    return stock > 0
      ? ProductAvailability.IN_STOCK
      : ProductAvailability.OUT_OF_STOCK;
  }

  // --- Validate ObjectId ---
  private validateObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
  }

  //  Create product
  async create(
    dto: CreateProductDto,
    files?: Express.Multer.File[],
  ): Promise<Product> {
    try {
      // Validate referenced IDs
      this.validateObjectId(dto.category);
      this.validateObjectId(dto.brand);
      this.validateObjectId(dto.procedure);

      const procedure = await this.productModel.db
        .collection('procedures')
        .findOne({ _id: new Types.ObjectId(dto.procedure) });

      if (!procedure) {
        throw new BadRequestException('Invalid procedure ID');
      }

      let imageUrls: string[] = [];

      // If files are provided, upload them
      if (files && files.length > 0) {
        imageUrls = await this.processAndUploadImageFiles(files);
      }
      // If images are provided in DTO (existing URLs), use them
      else if (dto.images && dto.images.length > 0) {
        imageUrls = dto.images;
      }

      // Always determine availability based on stock
      const availability = this.updateAvailabilityBasedOnStock(dto.stock || 0);

      const created = await this.productModel.create({
        ...dto,
        procedureName: procedure.name,
        images: imageUrls,
        availability,
      });

      const product = await this.productModel
        .findById(created._id)
        .populate('category', 'name')
        .populate('brand', 'name')
        .populate('procedure', 'name')
        .exec();

      if (!product) {
        throw new Error('Failed to create product');
      }

 

      return product;
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to create product',
      );
    }
  }

  async findAll(
    query: GetProductsDto,
    userId?: string,
  ): Promise<{
    data: Product[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      brand,
      procedure,
      availability,
      isFeatured,
      isPublished,
      minPrice,
      maxPrice,
    } = query;
    const filter: any = {};

    // 🔍 --- Smart search logic ---
    if (search && search.trim() !== '') {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Try text search first (if index exists), fallback to regex
      try {
        const textIndexExists = await this.productModel.collection.indexExists(
          'name_text_description_text',
        );

        if (textIndexExists) {
          filter.$text = { $search: search };
        } else {
          filter.$or = [
            { name: { $regex: escaped, $options: 'i' } },
            { description: { $regex: escaped, $options: 'i' } },
          ];
        }
      } catch {
        filter.$or = [
          { name: { $regex: escaped, $options: 'i' } },
          { description: { $regex: escaped, $options: 'i' } },
        ];
      }
    }

    // Filter by multiple categories
    if (category) {
      try {
        const categoryIds = Array.isArray(category) ? category : [category];

        // Validate all category IDs
        categoryIds.forEach((id) => this.validateObjectId(id));

        if (categoryIds.length === 1) {
          // Single category filter
          filter.category = categoryIds[0];
        } else {
          // Multiple categories filter
          filter.category = { $in: categoryIds };
        }

        // this.logger.debug(
        //   `Filtering by categories: ${JSON.stringify(categoryIds)}`,
        // );
      } catch (error) {
        this.logger.error(`Invalid category ID: ${error.message}`, error.stack);
        throw new BadRequestException('Invalid category ID format');
      }
    }

    // Filter by multiple brands
    if (brand) {
      try {
        const brandIds = Array.isArray(brand) ? brand : [brand];

        // Validate all brand IDs
        brandIds.forEach((id) => this.validateObjectId(id));

        if (brandIds.length === 1) {
          // Single brand filter
          filter.brand = brandIds[0];
        } else {
          // Multiple brands filter
          filter.brand = { $in: brandIds };
        }

        // this.logger.debug(`Filtering by brands: ${JSON.stringify(brandIds)}`);
      } catch (error) {
        this.logger.error(`Invalid brand ID: ${error.message}`, error.stack);
        throw new BadRequestException('Invalid brand ID format');
      }
    }

    // Filter by multiple procedures
    if (procedure) {
      try {
        const procedureIds = Array.isArray(procedure) ? procedure : [procedure];

        // Validate all procedure IDs
        procedureIds.forEach((id) => this.validateObjectId(id));

        if (procedureIds.length === 1) {
          // Single procedure filter
          filter.procedure = procedureIds[0];
        } else {
          // Multiple procedures filter
          filter.procedure = { $in: procedureIds };
        }

        // this.logger.debug(
        //   `Filtering by procedures: ${JSON.stringify(procedureIds)}`,
        // );
      } catch (error) {
        this.logger.error(
          `Invalid procedure ID: ${error.message}`,
          error.stack,
        );
        throw new BadRequestException('Invalid procedure ID format');
      }
    }

    // Filter by availability
    if (availability) {
      filter.availability = availability;
    }

    // Filter by featured
    if (isFeatured !== undefined) {
      filter.isFeatured = isFeatured;
    }

    // Filter by isPublished (public vs private/locked)
    if (isPublished === 'all') {
      // Return all products (public & private)
    } else if (isPublished === 'false' || isPublished === 'private') {
      filter.isPublished = false;
    } else {
      // Default / Public website queries: include published (true) and existing documents (not false)
      filter.isPublished = { $ne: false };
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = minPrice;
      if (maxPrice !== undefined) filter.price.$lte = maxPrice;
    }

    const skip = (page - 1) * limit;

    try {
      // this.logger.debug(
      //   `Executing find with filter: ${JSON.stringify(filter, null, 2)}`,
      // );

      const [data, total] = await Promise.all([
        this.productModel
          .find(filter)
          .populate('category', 'name')
          .populate('brand', 'name')
          .populate('procedure', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.productModel.countDocuments(filter).exec(),
      ]);

      // this.logger.debug(`Found ${data.length} products with total ${total}`);

      let enhancedData = data;
      if (userId) {
        try {
          const productIds = data.map((product) => product._id.toString());
          const favouriteStatusMap =
            await this.favouritesService.getBulkFavouriteStatus(
              userId,
              productIds,
            );

          enhancedData = data.map((product) => ({
            ...product,
            isFavourite: favouriteStatusMap[product._id.toString()] || false,
          }));
        } catch (error) {
          this.logger.warn(`Failed to get bulk favourite status: ${error.message}`);
          enhancedData = data.map((product) => ({
            ...product,
            isFavourite: false,
          }));
        }
      }

      return {
        data: enhancedData,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch products: ${error.message}`);
      throw new BadRequestException('Failed to fetch products');
    }
  }

  async findOneByProductId(
    productId: string,
    userId?: string,
    includePrivate: boolean = false,
  ): Promise<any> {
    if (!productId || typeof productId !== 'string') {
      throw new BadRequestException('Invalid productId');
    }

    const product = await this.productModel
      .findOneAndUpdate({ productId }, { $inc: { views: 1 } }, { new: true })
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('procedure', 'name')
      .lean();

    if (!product || (!includePrivate && product.isPublished === false)) {
      throw new NotFoundException(
        `Product with productId ${productId} not found`,
      );
    }

    // Add favourite status if user ID is provided
    if (userId) {
      try {
        const favouriteStatus =
          await this.favouritesService.isProductInFavourites(
            userId,
            product._id.toString(),
          );
        (product as any).isFavourite = favouriteStatus.isFavourite;
      } catch (error) {
        this.logger.warn(`Failed to check favourite status: ${error.message}`);
      }
    }

    return product;
  }

  async findOne(id: string, userId?: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid product ID');
    }

    const product = await this.productModel
      .findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true })
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('procedure', 'name')
      .lean();

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Add favourite status if user ID is provided
    if (userId) {
      try {
        const favouriteStatus =
          await this.favouritesService.isProductInFavourites(userId, id);
        // Use type assertion to add the computed field
        (product as any).isFavourite = favouriteStatus.isFavourite;
      } catch (error) {
        this.logger.warn(`Failed to check favourite status: ${error.message}`);
      }
    }

    return product;
  }

  async updateSimple(
    id: string,
    dto: UpdateProductDto,
    files?: Express.Multer.File[],
  ): Promise<Product> {
    this.validateObjectId(id);

    const existing = await this.productModel.findById(id);
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    // 1️⃣ Upload new images (if any)
    let newImageUrls: string[] = [];
    if (files && files.length > 0) {
      newImageUrls = await this.processAndUploadImageFiles(files);
    }

    // 2️⃣ Determine final image list (frontend sends the ones to keep)
    const existingUrls = dto.images ?? [];
    const updatedImages = [...existingUrls, ...newImageUrls];

    // 3️⃣ Delete removed images from storage
    const removedImages = existing.images.filter(
      (url) => !updatedImages.includes(url),
    );
    if (removedImages.length > 0) {
      await this.deleteImagesFromStorage(removedImages);
    }

    // 4️⃣ Always update images and mark modified
    existing.images = updatedImages;
    existing.markModified('images'); // <-- ✅ ensures removal-only updates are saved

    // 5️⃣ Update other fields (if any)
    Object.keys(dto).forEach((key) => {
      if (dto[key] !== undefined && !['images', 'availability'].includes(key)) {
        (existing as any)[key] = dto[key];
      }
    });

    // 6️⃣ Update availability automatically based on stock
    existing.availability = this.updateAvailabilityBasedOnStock(
      dto.stock ?? existing.stock,
    );

    await existing.save();

    const updated = await this.productModel
      .findById(existing._id)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('procedure', 'name')
      .exec();

    if (!updated) throw new NotFoundException('Product not found after update');

    return updated;
  }

  async addImages(id: string, files: Express.Multer.File[]): Promise<Product> {
    this.validateObjectId(id);

    const existing = await this.productModel.findById(id);
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const newImageUrls = await this.processAndUploadImageFiles(files);
    existing.images.push(...newImageUrls);

    await existing.save();

    const updated = await this.productModel
      .findById(id)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('procedure', 'name')
      .exec();

    return updated!;
  }

  // --- Remove specific image from product ---
  async removeImage(id: string, imageIndex: number): Promise<Product> {
    this.validateObjectId(id);

    const existing = await this.productModel.findById(id);
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    if (imageIndex < 0 || imageIndex >= existing.images.length) {
      throw new BadRequestException('Invalid image index');
    }

    // Remove the image from storage
    const imageUrlToRemove = existing.images[imageIndex];
    try {
      await this.fileUploadService.deleteFile(imageUrlToRemove);
    } catch (error) {
      this.logger.warn(
        `Failed to delete image file: ${imageUrlToRemove}`,
        error,
      );
    }

    // Remove from array
    existing.images.splice(imageIndex, 1);
    await existing.save();

    const updated = await this.productModel
      .findById(id)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('procedure', 'name')
      .exec();

    return updated!;
  }

  // --- Update product stock and availability ---
  async updateStock(id: string, stock: number): Promise<Product> {
    this.validateObjectId(id);

    const existing = await this.productModel.findById(id);
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    existing.stock = stock;
    existing.availability = this.updateAvailabilityBasedOnStock(stock);

    await existing.save();

    const updated = await this.productModel
      .findById(id)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('procedure', 'name')
      .exec();

    return updated!;
  }

  // --- Increment sales count ---
  async incrementSales(id: string, quantity: number = 1): Promise<Product> {
    this.validateObjectId(id);

    const existing = await this.productModel.findById(id);
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    if (existing.stock < quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    existing.salesCount += quantity;
    existing.stock = Math.max(0, existing.stock - quantity);
    existing.availability = this.updateAvailabilityBasedOnStock(existing.stock);

    await existing.save();

    const updated = await this.productModel
      .findById(id)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('procedure', 'name')
      .exec();

    return updated!;
  }

  // --- Toggle featured status ---
  async toggleFeatured(id: string): Promise<Product> {
    this.validateObjectId(id);

    const existing = await this.productModel.findById(id);
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    existing.isFeatured = !existing.isFeatured;
    await existing.save();

    const updated = await this.productModel
      .findById(id)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('procedure', 'name')
      .exec();

    return updated!;
  }

  // --- Toggle published (public/private) status ---
  async togglePublish(id: string): Promise<Product> {
    this.validateObjectId(id);

    const existing = await this.productModel.findById(id);
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    existing.isPublished = !existing.isPublished;
    await existing.save();

    const updated = await this.productModel
      .findById(id)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('procedure', 'name')
      .exec();

    return updated!;
  }

  // --- Get featured products ---
  async getFeaturedProducts(limit: number = 10): Promise<Product[]> {
    return this.productModel
      .find({
        isFeatured: true,
        availability: ProductAvailability.IN_STOCK,
      })
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('procedure', 'name')
      .sort({ salesCount: -1, createdAt: -1 })
      .limit(limit)
      .exec();
  }

  // --- Delete entire product record and all associated images ---
  async remove(id: string): Promise<void> {
    this.validateObjectId(id);

    const existing = await this.productModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Delete all associated images from storage
    await this.deleteImagesFromStorage(existing.images);

    // Delete the document
    await this.productModel.findByIdAndDelete(id);
  }

  // --- Helper to delete multiple images from storage ---
  private async deleteImagesFromStorage(imageUrls: string[]): Promise<void> {
    if (!imageUrls.length) return;

    const deletePromises = imageUrls.map((url) =>
      this.fileUploadService.deleteFile(url).catch((error) => {
        this.logger.warn(`Failed to delete image ${url}:`, error);
      }),
    );

    await Promise.all(deletePromises);
  }

  // --- Get hot selling products ---
  async getHotSellingProducts(
    limit: number = 10,
    days?: number,
    userId?: string,
  ): Promise<any[]> {
    try {
      // Remove the product ID validation since this endpoint doesn't use a product ID
      // Build date filter if days parameter is provided
      const dateFilter: any = {};
      if (days) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        dateFilter.createdAt = { $gte: startDate };
      }

      // Use aggregation pipeline to get products sorted by sales count
      const aggregationPipeline: any[] = [
        {
          $match: {
            ...dateFilter,
            availability: ProductAvailability.IN_STOCK,
          },
        },
        { $sort: { salesCount: -1, createdAt: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'category',
          },
        },
        {
          $lookup: {
            from: 'brands',
            localField: 'brand',
            foreignField: '_id',
            as: 'brand',
          },
        },
        {
          $lookup: {
            from: 'procedures',
            localField: 'procedure',
            foreignField: '_id',
            as: 'procedure',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$procedure', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            productId: 1, // include productId
            productCode: 1,
            name: 1,
            price: 1,
            images: 1,
            salesCount: 1,
            views: 1,
            isFeatured: 1,
            availability: 1,
            'category.name': 1,
            'brand.name': 1,
            'procedure.name': 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ];

      let products = await this.productModel
        .aggregate(aggregationPipeline)
        .exec();

      // Add favourite status if user ID is provided
      if (userId && products.length > 0) {
        try {
          const productIds = products.map((product) => product._id.toString());
          const favouriteStatusMap =
            await this.favouritesService.getBulkFavouriteStatus(
              userId,
              productIds,
            );

          products = products.map((product) => ({
            ...product,
            isFavourite: favouriteStatusMap[product._id.toString()] || false,
          }));
        } catch (error) {
          this.logger.warn(
            `Failed to get bulk favourite status for hot selling products: ${error.message}`,
          );
          products = products.map((product) => ({
            ...product,
            isFavourite: false,
          }));
        }
      }

      return products;
    } catch (error) {
      this.logger.error(
        `Failed to fetch hot selling products: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to fetch hot selling products');
    }
  }

  // --- Get sales analytics for admin dashboard ---
  async getSalesAnalytics(
    days: number = 30,
    limit: number = 20,
  ): Promise<{
    topProducts: any[];
    totalSales: number;
    period: string;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      const aggregationPipeline = [
        {
          $match: {
            createdAt: { $gte: startDate },
            salesCount: { $gt: 0 },
          },
        },
        { $sort: { salesCount: -1 as 1 | -1 } },
        { $limit: limit },
        {
          $group: {
            _id: null,
            topProducts: { $push: '$$ROOT' },
            totalSales: { $sum: '$salesCount' },
          },
        },
        {
          $project: {
            _id: 0,
            topProducts: 1,
            totalSales: 1,
          },
        },
      ];

      const result = await this.productModel
        .aggregate(aggregationPipeline)
        .exec();

      const analytics =
        result.length > 0 ? result[0] : { topProducts: [], totalSales: 0 };

      // Populate category, brand, and procedure names for top products
      if (analytics.topProducts.length > 0) {
        const populatedProducts = await this.productModel
          .find({
            _id: { $in: analytics.topProducts.map((p) => p._id) },
          })
          .populate('category', 'name')
          .populate('brand', 'name')
          .populate('procedure', 'name')
          .lean()
          .exec();

        analytics.topProducts = populatedProducts;
      }

      return {
        ...analytics,
        period: `${days} days`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch sales analytics: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to fetch sales analytics');
    }
  }

  // --- Get related products ---
  async getRelatedProducts(
    productId: string,
    limit: number = 8,
    userId?: string,
  ): Promise<any[]> {
    this.validateObjectId(productId);

    try {
      // First, get the current product to find related criteria
      const currentProduct = await this.productModel
        .findById(productId)
        .lean()
        .exec();

      if (!currentProduct) {
        throw new NotFoundException('Product not found');
      }

      const relatedConditions: Array<Record<string, any>> = [];

      // Add conditions based on available relations:cite[8]
      if (currentProduct.category) {
        relatedConditions.push({
          category: currentProduct.category,
          _id: { $ne: currentProduct._id },
        });
      }

      if (currentProduct.brand) {
        relatedConditions.push({
          brand: currentProduct.brand,
          _id: { $ne: currentProduct._id },
        });
      }

      if (currentProduct.procedure) {
        relatedConditions.push({
          procedure: currentProduct.procedure,
          _id: { $ne: currentProduct._id },
        });
      }

      // If no relations found, return empty array
      if (relatedConditions.length === 0) {
        return [];
      }

      // Use $or to find products matching any of the related conditions
      let relatedProducts = await this.productModel
        .find({
          $or: relatedConditions,
          availability: ProductAvailability.IN_STOCK,
        })
        .populate('category', 'name')
        .populate('brand', 'name')
        .populate('procedure', 'name')
        .sort({
          salesCount: -1,
          isFeatured: -1,
          createdAt: -1,
        })
        .limit(limit)
        .lean()
        .exec();

      // Add favourite status if user ID is provided
      if (userId && relatedProducts.length > 0) {
        try {
          const productIds = relatedProducts.map((product) =>
            product._id.toString(),
          );
          const favouriteStatusMap =
            await this.favouritesService.getBulkFavouriteStatus(
              userId,
              productIds,
            );

          relatedProducts = relatedProducts.map((product) => ({
            ...product,
            isFavourite: favouriteStatusMap[product._id.toString()] || false,
          }));
        } catch (error) {
          this.logger.warn(
            `Failed to get bulk favourite status for related products: ${error.message}`,
          );
          relatedProducts = relatedProducts.map((product) => ({
            ...product,
            isFavourite: false,
          }));
        }
      }

      return relatedProducts;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Failed to fetch related products: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to fetch related products');
    }
  }

  // --- Get frequently bought together products ---
  async getFrequentlyBoughtTogether(
    productId: string,
    limit: number = 4,
    userId?: string,
  ): Promise<any[]> {
    this.validateObjectId(productId);

    // For a real implementation, you would analyze order history
    // This is a simplified version that returns products from same category and brand
    try {
      const currentProduct = await this.productModel
        .findById(productId)
        .lean()
        .exec();

      if (!currentProduct) {
        throw new NotFoundException('Product not found');
      }

      let togetherProducts = await this.productModel
        .find({
          $and: [
            {
              $or: [
                { category: currentProduct.category },
                { brand: currentProduct.brand },
              ],
            },
            { _id: { $ne: currentProduct._id } },
            { availability: ProductAvailability.IN_STOCK },
          ],
        })
        .populate('category', 'name')
        .populate('brand', 'name')
        .populate('procedure', 'name')
        .sort({
          salesCount: -1,
          isFeatured: -1,
        })
        .limit(limit)
        .lean()
        .exec();

      // Add favourite status if user ID is provided
      if (userId && togetherProducts.length > 0) {
        try {
          const productIds = togetherProducts.map((product) =>
            product._id.toString(),
          );
          const favouriteStatusMap =
            await this.favouritesService.getBulkFavouriteStatus(
              userId,
              productIds,
            );

          togetherProducts = togetherProducts.map((product) => ({
            ...product,
            isFavourite: favouriteStatusMap[product._id.toString()] || false,
          }));
        } catch (error) {
          this.logger.warn(
            `Failed to get bulk favourite status for frequently bought together: ${error.message}`,
          );
          togetherProducts = togetherProducts.map((product) => ({
            ...product,
            isFavourite: false,
          }));
        }
      }

      return togetherProducts;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Failed to fetch frequently bought together products: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        'Failed to fetch frequently bought together products',
      );
    }
  }
}
