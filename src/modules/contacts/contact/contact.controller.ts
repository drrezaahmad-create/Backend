import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ContactService } from './contact.service';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { CreateMessageDto } from 'src/modules/contacts/contact/dto/create-contact.dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post('message')
  async sendMessage(@Body() dto: CreateMessageDto, @Req() req: any) {
    const userId = req.user?.userId;
    return this.contactService.submitMessage(dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('messages')
  async getMessages() {
    return this.contactService.getAllMessages();
  }
}
