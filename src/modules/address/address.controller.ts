import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Patch,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';

@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post()
  create(@Req() req, @Body() dto: CreateAddressDto) {
    return this.addressService.create(req.user.userId, dto);
  }

  // Get my addresses
  @Get('my')
  getMyAddresses(@Req() req) {
    return this.addressService.findAll(req.user.userId);
  }

  @Get()
  findAll(@Req() req) {
    return this.addressService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.addressService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    return this.addressService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.addressService.remove(req.user.userId, id);
  }
}
