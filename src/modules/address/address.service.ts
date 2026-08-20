import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Address, AddressDocument } from './address.schema';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UsersService } from 'src/modules/users/users.service';

@Injectable()
export class AddressService {
  constructor(
    @InjectModel(Address.name)
    private readonly addressModel: Model<AddressDocument>,
    private readonly usersService: UsersService,
  ) {}

  async create(
    userId: Types.ObjectId,
    dto: CreateAddressDto,
  ): Promise<Address> {
    const user = await this.usersService.findById(userId.toString());
    if (!user) throw new NotFoundException('User not found');

    const newAddress = new this.addressModel({
      ...dto,
      userId,
      recipientFirstName: dto.recipientFirstName ?? user.firstName,
      recipientLastName: dto.recipientLastName ?? user.lastName,
      recipientEmail: dto.recipientEmail ?? user.email,
      recipientPhone: dto.recipientPhone ?? user.phone,
    });

    return await newAddress.save();
  }

  async findAll(userId: Types.ObjectId): Promise<Address[]> {
    return this.addressModel.find({ userId }).exec();
  }

  async findOne(userId: Types.ObjectId, id: string): Promise<Address> {
    const address = await this.addressModel.findOne({
      _id: id,
      userId,
    });

    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async update(
    userId: Types.ObjectId,
    id: string,
    dto: UpdateAddressDto,
  ): Promise<Address> {
    const address = await this.addressModel.findOneAndUpdate(
      { _id: id, userId },
      dto,
      { new: true },
    );

    if (!address) throw new NotFoundException('Address not found or not yours');
    return address;
  }

  async remove(
    userId: Types.ObjectId,
    id: string,
  ): Promise<{ message: string }> {
    const result = await this.addressModel.deleteOne({ _id: id, userId });
    if (result.deletedCount === 0)
      throw new NotFoundException('Address not found or not yours');
    return { message: 'Address deleted successfully' };
  }
}
