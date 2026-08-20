
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from 'src/modules/dashboard/dashboard.controller';
import { DashboardService } from 'src/modules/dashboard/dashboard.service';
import { Order, OrderSchema } from 'src/modules/order/order.schema';
import { User, UserSchema } from 'src/modules/users/schema/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class AdminDashboardModule {}
