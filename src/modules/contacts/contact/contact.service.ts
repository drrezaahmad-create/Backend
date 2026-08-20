import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Message, MessageDocument } from './message.schema';
import { User } from 'src/modules/users/schema/user.schema';
import { CreateMessageDto } from 'src/modules/contacts/contact/dto/create-contact.dto';
import { NotificationService } from 'src/modules/notification/notification.service';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly notificationService: NotificationService,
  ) {}

  async submitMessage(dto: CreateMessageDto, userId?: string) {
    const message = await this.messageModel.create({ ...dto, userId });

    // Notify all admins
    const admins = await this.userModel.find({ role: 'admin' }).exec();
    await Promise.all(
      admins.map((admin) =>
        this.notificationService.createNotification({
          title: 'New Contact Message',
          body: `A new message has been sent via contact form by ${dto.email || 'a user'}.`,
          user: admin._id.toString(),
          metadata: {
            messageId: message._id,
            from: dto.email,
            subject: dto.subject,
          },
        }),
      ),
    );
    return message;
  }

  async getAllMessages(): Promise<Message[]> {
    return this.messageModel.find().sort({ createdAt: -1 }).exec();
  }
}
