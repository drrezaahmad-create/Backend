import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Product } from 'src/modules/products/schema/product.schema';
import { Category } from 'src/modules/categories/category.schema';
import { Model } from 'mongoose';
import { Brand } from 'src/modules/brand/brand.schema';
import { Procedure } from 'src/modules/procedure/procedure.schema';

@Injectable()
export class GlobalSearchService {
  private readonly logger = new Logger(GlobalSearchService.name);

  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Brand.name) private brandModel: Model<Brand>,
    @InjectModel(Category.name) private categoryModel: Model<Category>,
    @InjectModel(Procedure.name) private procedureModel: Model<Procedure>,
  ) {}

  async search(query: string, limit = 10, modules?: string[]) {
    const regex = new RegExp(query, 'i');
    const results: Record<string, any> = {};

    const safeLimit = Math.max(1, Math.min(limit, 50));
    const promises: Promise<void>[] = [];

    // Products
    if (!modules || modules.includes('products')) {
      promises.push(
        this.productModel
          .find({
            $or: [{ name: regex }, { description: regex }],
          })
          .limit(safeLimit)
          .select('name price imageUrl category brand procedure')
          .populate('category', 'name')
          .populate('brand', 'name')
          .populate('procedure', 'name')
          .lean()
          .then((items) => {
            results.products = items;
          }),
      );
    }

    // Brands
    if (!modules || modules.includes('brands')) {
      promises.push(
        this.brandModel
          .find({ name: regex })
          .limit(safeLimit)
          .select('name')
          .lean()
          .then((items) => {
            results.brands = items;
          }),
      );
    }

    // Categories
    if (!modules || modules.includes('categories')) {
      promises.push(
        this.categoryModel
          .find({ name: regex })
          .limit(safeLimit)
          .select('name imageUrl')
          .lean()
          .then((items) => {
            results.categories = items;
          }),
      );
    }

    // Procedures
    if (!modules || modules.includes('procedures')) {
      promises.push(
        this.procedureModel
          .find({
            $or: [{ name: regex }, { description: regex }],
          })
          .limit(safeLimit)
          .select('name description imageUrl')
          .lean()
          .then((items) => {
            results.procedures = items;
          }),
      );
    }

    try {
      await Promise.all(promises);
      return results;
    } catch (error) {
      this.logger.error('Global search failed', error);
      throw error;
    }
  }
}
