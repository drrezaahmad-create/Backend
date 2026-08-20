import {
  Controller,
  Get,
  Put,
  Body,
  Post,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ContactInfoService } from './contact-info.service';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/enum/user_role.enum';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import {
  AddEmailsDto,
  RemoveManyDto,
  AddPhonesDto,
} from 'src/modules/contacts/contact-info/dto/create-contact-info.dto';

@Controller('contact-info')
export class ContactInfoController {
  constructor(private readonly contactInfoService: ContactInfoService) {}

  @Get()
  get() {
    return this.contactInfoService.getContactInfo();
  }

  @Put('update')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  update(@Body() body: any) {
    return this.contactInfoService.updateContactInfo(body);
  }

  // ------- SINGLE EMAIL (backward compatible)
  @Post('email')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  addEmail(@Body('email') email: string) {
    return this.contactInfoService.addEmail(email);
  }

  @Delete('email/:email')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEmail(@Param('email') email: string) {
    return this.contactInfoService.removeEmail(email);
  }

  // ------- SINGLE PHONE (backward compatible)
  @Post('phone')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  addPhone(@Body('phone') phone: string) {
    return this.contactInfoService.addPhone(phone);
  }

  @Delete('phone/:phone')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removePhone(@Param('phone') phone: string) {
    return this.contactInfoService.removePhone(phone);
  }

  // ------- BULK EMAILS
  @Post('emails')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  addEmails(@Body() dto: AddEmailsDto) {
    return this.contactInfoService.addEmails(dto.emails);
  }

  @Delete('emails')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEmails(@Body() dto: RemoveManyDto) {
    return this.contactInfoService.removeEmails(dto.items);
  }

  // ------- BULK PHONES
  @Post('phones')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  addPhones(@Body() dto: AddPhonesDto) {
    return this.contactInfoService.addPhones(dto.phones);
  }

  @Delete('phones')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removePhones(@Body() dto: RemoveManyDto) {
    return this.contactInfoService.removePhones(dto.items);
  }
}
