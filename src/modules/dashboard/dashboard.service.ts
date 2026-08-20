import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from '../order/order.schema';
import { User } from '../users/schema/user.schema';
import { PaymentStatus } from 'src/common/enum/payment.enum';
import { UserStatus } from 'src/common/enum/user.status.enum';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async getOverview() {
    const [totalEarning, totalOrder, totalUser, blockedAccount] =
      await Promise.all([
        this.orderModel.aggregate([
          { $match: { paymentStatus: PaymentStatus.SUCCEEDED } },
          { $group: { _id: null, total: { $sum: '$total' } } },
        ]),
        this.orderModel.countDocuments(),
        this.userModel.countDocuments(),
        this.userModel.countDocuments({ status: UserStatus.BLOCKED }),
      ]);

    return {
      totalEarning: totalEarning[0]?.total || 0,
      totalOrder,
      totalUser,
      blockedAccount,
    };
  }

  async getUserGrowth(year: number) {
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${year + 1}-01-01`);

    const data = await this.userModel.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { $month: '$createdAt' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const result = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      count: data.find((d) => d._id === i + 1)?.count || 0,
    }));

    return result;
  }

  async getOrderGrowth(year: number) {
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${year + 1}-01-01`);

    const data = await this.orderModel.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { $month: '$createdAt' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      count: data.find((d) => d._id === i + 1)?.count || 0,
    }));
  }

  async getEarningGrowth(year: number) {
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${year + 1}-01-01`);

    const data = await this.orderModel.aggregate([
      {
        $match: {
          paymentStatus: PaymentStatus.SUCCEEDED,
          createdAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          total: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      total: data.find((d) => d._id === i + 1)?.total || 0,
    }));
  }
}
