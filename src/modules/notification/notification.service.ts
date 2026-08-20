import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './notification.schema';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  async createNotification(data: {
    title: string;
    body: string;
    metadata?: Record<string, any>;
    user: Types.ObjectId | string;
  }) {
    try {
      const notification = new this.notificationModel(data);
      await notification.save();
      return notification;
    } catch (error) {
      this.logger.error(
        `Notification creation failed: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to create notification');
    }
  }

  async findById(notificationId: string) {
    return this.notificationModel.findById(notificationId).lean();
  }

  async getUserNotifications(userId: string) {
    try {
      return await this.notificationModel
        .find({ user: userId })
        .sort({ createdAt: -1 })
        .lean();
    } catch (error) {
      this.logger.error(
        `Get notifications failed: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to get notifications');
    }
  }

  async markAsRead(notificationId: string) {
    try {
      const updated = await this.notificationModel.findByIdAndUpdate(
        notificationId,
        { isRead: true },
        { new: true },
      );
      if (!updated) {
        this.logger.warn(`Notification not found: ${notificationId}`);
        throw new NotFoundException('Notification not found');
      }
      return updated;
    } catch (error) {
      this.logger.error(`Mark as read failed: ${error.message}`, error.stack);
      throw new Error('Failed to mark notification as read');
    }
  }
}
