import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/enum/user_role.enum';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview() {
    const data = await this.dashboardService.getOverview();
    return {
      statusCode: 200,
      message: 'Dashboard overview fetched successfully',
      data,
    };
  }

  @Get('user-growth')
  async getUserGrowth(@Query('year') year: number = new Date().getFullYear()) {
    const data = await this.dashboardService.getUserGrowth(year);
    return {
      statusCode: 200,
      message: 'User growth fetched successfully',
      data,
    };
  }

  @Get('order-growth')
  async getOrderGrowth(@Query('year') year: number = new Date().getFullYear()) {
    const data = await this.dashboardService.getOrderGrowth(year);
    return {
      statusCode: 200,
      message: 'Order growth fetched successfully',
      data,
    };
  }

  @Get('earning-growth')
  async getEarningGrowth(
    @Query('year') year: number = new Date().getFullYear(),
  ) {
    const data = await this.dashboardService.getEarningGrowth(year);
    return {
      statusCode: 200,
      message: 'Earning growth fetched successfully',
      data,
    };
  }
}
