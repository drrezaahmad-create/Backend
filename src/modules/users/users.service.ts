import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { UserStatus } from 'src/common/enum/user.status.enum';
import { Role } from 'src/common/enum/user_role.enum';
import { Address, AddressDocument } from 'src/modules/address/address.schema';
import { FileUploadService } from 'src/modules/file-upload/file-upload.service';
import { NotificationService } from 'src/modules/notification/notification.service';
import { User, UserDocument } from 'src/modules/users/schema/user.schema';
import { UpdateProfileDto } from 'src/modules/users/dto/update-profile.dto';
import { UpdateUserDto } from 'src/modules/users/dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Address.name) private addressModel: Model<AddressDocument>,
    private fileUploadService: FileUploadService,
    private readonly notificationService: NotificationService,
  ) {}

  // Find user by email
  async findByEmail(email: string): Promise<UserDocument | null> {
    return await this.userModel.findOne({ email }).exec();
  }

  // Find all users by role
  async findAllByRole(role: Role): Promise<UserDocument[]> {
    return await this.userModel
      .find({ role })
      .select('-password -refreshToken')
      .exec();
  }

  // Find user by ID
  async findById(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }
    return await this.userModel.findById(id).exec();
  }

  // Find user by ID with addresses
  async findByIdWithAddresses(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }

    const user = await this.userModel
      .findById(id)
      .select('-password -refreshToken')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find addresses for the user
    const addresses = await this.addressModel
      .find({ userId: id })
      .lean()
      .exec();

    return {
      ...user,
      addresses,
    };
  }

  // Get all users with optional filtering and pagination
  async findAll(
    page: number = 1,
    limit: number = 10,
    role?: Role,
    status?: UserStatus,
    search?: string,
  ): Promise<{ users: UserDocument[]; total: number; pages: number }> {
    const query: any = {};

    if (role) query.role = role;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.userModel
        .find(query)
        .select(
          '-password -refreshToken -emailVerificationCodeHash -resetPasswordCodeHash',
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(query),
    ]);

    return {
      users,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  // Get users by role
  async findByRole(role: Role): Promise<UserDocument[]> {
    return await this.userModel
      .find({ role })
      .select(
        '-password -refreshToken -emailVerificationCodeHash -resetPasswordCodeHash',
      )
      .exec();
  }

  // Get users by status
  async findByStatus(status: UserStatus): Promise<UserDocument[]> {
    return await this.userModel
      .find({ status })
      .select(
        '-password -refreshToken -emailVerificationCodeHash -resetPasswordCodeHash',
      )
      .exec();
  }

  // Create new user
  async createUser(
    data: Partial<User>,
    session?: ClientSession,
  ): Promise<UserDocument> {
    if (!data.email) {
      throw new BadRequestException('Email is required');
    }

    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const user = new this.userModel(data);
    const savedUser = await user.save({ session });

    // Notify admins about new registration
    try {
      const admins = await this.userModel.find({ role: Role.ADMIN }).exec();
      await Promise.all(
        admins.map((admin) =>
          this.notificationService.createNotification({
            title: 'New User Registration',
            body: `${data.email} has registered as ${data.role}`,
            user: admin.id.toString(),
            metadata: { signup: true, newUserId: savedUser._id },
          }),
        ),
      );
    } catch (error) {
      // Log error but don't fail user creation
      this.logger.error('Failed to send admin notifications:', error);
    }

    return savedUser;
  }

  // Update own profile (for regular users)
  async updateOwnProfile(
    userId: string,
    dto: UpdateProfileDto,
    file?: Express.Multer.File,
  ): Promise<any> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Only allow specific fields for own profile update
    const allowedUpdates = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      gdcNumber: dto.gdcNumber,
      clinicName: dto.clinicName,
    };

    // Remove undefined fields
    Object.keys(allowedUpdates).forEach((key) => {
      if (allowedUpdates[key] === undefined) {
        delete allowedUpdates[key];
      }
    });

    if (file) {
      const imageUrl = await this.fileUploadService.handleUpload(file);
      allowedUpdates['imageUrl'] = imageUrl;
    }

    Object.assign(user, allowedUpdates);
    await user.save();

    // Sanitize output
    const {
      password,
      refreshToken,
      emailVerificationCodeHash,
      resetPasswordCodeHash,
      ...safe
    } = user.toObject({
      getters: true,
      virtuals: false,
    });
    return safe;
  }

  // Update user (for admin or own profile)
  async updateUser(
    id: string,
    updateData: UpdateUserDto,
    file?: Express.Multer.File,
  ): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }

    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check email uniqueness if email is being updated
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await this.findByEmail(updateData.email);
      if (existingUser) {
        throw new BadRequestException('Email already exists');
      }
    }

    // Handle file upload if provided
    if (file) {
      const imageUrl = await this.fileUploadService.handleUpload(file);
      updateData.imageUrl = imageUrl;
    }

    Object.assign(user, updateData);
    await user.save();

    // Sanitize output
    const {
      password,
      refreshToken,
      emailVerificationCodeHash,
      resetPasswordCodeHash,
      ...safe
    } = user.toObject({
      getters: true,
      virtuals: false,
    });
    return safe;
  }

  async toggleBlockUser(
    id: string,
  ): Promise<{ message: string; user: any; action: 'blocked' | 'unblocked' }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }

    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const previousStatus = user.status;
    let newStatus: UserStatus;
    let action: 'blocked' | 'unblocked';

    // Toggle between BLOCKED and APPROVED
    if (user.status === UserStatus.BLOCKED) {
      newStatus = UserStatus.APPROVED;
      action = 'unblocked';
    } else {
      newStatus = UserStatus.BLOCKED;
      action = 'blocked';
    }

    user.status = newStatus;

    // Clear refresh token and sessions if blocking user
    if (action === 'blocked') {
      user.refreshToken = null;
    }

    await user.save();

    // Send notification to the user
    try {
      await this.notificationService.createNotification({
        title: `Account ${action === 'blocked' ? 'Blocked' : 'Unblocked'}`,
        body:
          action === 'blocked'
            ? 'Your account has been blocked. Please contact administrator for more information.'
            : 'Your account has been unblocked. You can now access all features.',
        user: user.id.toString(),
        metadata: { previousStatus, newStatus, action },
      });
    } catch (error) {
      this.logger.error('Failed to send user notification:', error);
    }

    // Notify admins about status change
    try {
      const admins = await this.userModel.find({ role: Role.ADMIN }).exec();
      await Promise.all(
        admins.map((admin) =>
          this.notificationService.createNotification({
            title: `User ${action === 'blocked' ? 'Blocked' : 'Unblocked'}`,
            body: `User ${user.email} has been ${action}.`,
            user: admin.id.toString(),
            metadata: {
              changedUserId: user._id,
              previousStatus,
              newStatus,
              action,
              userEmail: user.email,
            },
          }),
        ),
      );
    } catch (error) {
      this.logger.error('Failed to send admin notifications:', error);
    }

    // Sanitize user for response
    const {
      password,
      refreshToken,
      emailVerificationCodeHash,
      resetPasswordCodeHash,
      ...safeUser
    } = user.toObject({
      getters: true,
      virtuals: false,
    });

    return {
      message: `User ${action} successfully`,
      user: safeUser,
      action,
    };
  }

  // Update user status with enhanced logic
  async updateStatus(
    id: string,
    status: UserStatus,
  ): Promise<{ message: string; user: any }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }

    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const previousStatus = user.status;
    user.status = status;

    // Clear refresh token and sessions if user is blocked or rejected
    if (status === UserStatus.BLOCKED || status === UserStatus.REJECTED) {
      user.refreshToken = null;
    }

    await user.save();

    // Send notification to the user
    try {
      await this.notificationService.createNotification({
        title: 'Account Status Updated',
        body: `Your account status has been updated from ${previousStatus} to ${status}`,
        user: user.id.toString(),
        metadata: { previousStatus, newStatus: status },
      });
    } catch (error) {
      this.logger.error('Failed to send user notification:', error);
    }

    // Notify admins about status change
    try {
      const admins = await this.userModel.find({ role: Role.ADMIN }).exec();
      await Promise.all(
        admins.map((admin) =>
          this.notificationService.createNotification({
            title: `User Status Changed`,
            body: `User ${user.email} status changed from ${previousStatus} to ${status.toLowerCase()}.`,
            user: admin.id.toString(),
            metadata: {
              changedUserId: user._id,
              previousStatus,
              newStatus: status,
              userEmail: user.email,
            },
          }),
        ),
      );
    } catch (error) {
      this.logger.error('Failed to send admin notifications:', error);
    }

    // Sanitize user for response
    const {
      password,
      refreshToken,
      emailVerificationCodeHash,
      resetPasswordCodeHash,
      ...safeUser
    } = user.toObject({
      getters: true,
      virtuals: false,
    });

    return {
      message: `User status updated from ${previousStatus} to ${status}`,
      user: safeUser,
    };
  }

  // Update refresh token
  async updateRefreshToken(
    id: string,
    refreshToken: string | null,
  ): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { refreshToken },
      { new: true },
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // Delete user with enhanced cleanup
  async deleteUser(id: string): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }

    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Optional: Add any cleanup logic here (delete related addresses, etc.)
    // await this.addressModel.deleteMany({ userId: id });

    await this.userModel.findByIdAndDelete(id);

    // Notify admins about user deletion
    try {
      const admins = await this.userModel.find({ role: Role.ADMIN }).exec();
      await Promise.all(
        admins.map((admin) =>
          this.notificationService.createNotification({
            title: 'User Deleted',
            body: `User ${user.email} has been deleted from the system.`,
            user: admin.id.toString(),
            metadata: { deletedUserId: id, userEmail: user.email },
          }),
        ),
      );
    } catch (error) {
      this.logger.error('Failed to send deletion notifications:', error);
    }

    return { message: 'User deleted successfully' };
  }

  // Get user statistics
  async getUserStats(): Promise<{
    total: number;
    byRole: Record<Role, number>;
    byStatus: Record<UserStatus, number>;
    recentRegistrations: number;
  }> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [total, byRole, byStatus, recentRegistrations] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      this.userModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.userModel.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
    ]);

    const roleStats = byRole.reduce(
      (acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      },
      {} as Record<Role, number>,
    );

    const statusStats = byStatus.reduce(
      (acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      },
      {} as Record<UserStatus, number>,
    );

    return {
      total,
      byRole: roleStats,
      byStatus: statusStats,
      recentRegistrations,
    };
  }
}
