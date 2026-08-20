import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Request } from 'express';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/enum/user_role.enum';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async create(
    @Body()
    body: { title: string; content: string; userId?: string; metadata?: any },
    @Req() req: Request,
  ) {
    const requester = req.user as any;
    let userId = body.userId;

    if (!userId || requester.role !== Role.ADMIN) {
      userId = requester.userId;
    }
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    return this.notificationService.createNotification({
      title: body.title,
      body: body.content,
      metadata: body.metadata || {},
      user: userId,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserNotifications(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.notificationService.getUserNotifications(userId);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Param('id') id: string, @Req() req: Request) {
    const notification = await this.notificationService.findById(id);
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    const userId = (req.user as any).userId;
    if (notification.user.toString() !== userId) {
      throw new ForbiddenException(
        "Can't mark notifications that aren't yours",
      );
    }
    return this.notificationService.markAsRead(id);
  }
}
