import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
  HttpStatus,
  UploadedFile,
  HttpCode,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from 'src/common/decorator/roles.decorator';
import { UserStatus } from 'src/common/enum/user.status.enum';
import { Role } from 'src/common/enum/user_role.enum';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { UseGlobalFileInterceptor } from 'src/common/decorator/globalFileInterceptor.decorator';
import { UpdateProfileDto } from 'src/modules/users/dto/update-profile.dto';
import { UpdateUserDto } from 'src/modules/users/dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Get current user profile with addresses
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    const user = await this.usersService.findByIdWithAddresses(req.user.userId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Profile retrieved successfully',
      data: user,
    };
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @UseGlobalFileInterceptor({ fieldName: 'image' })
  async updateMyProfile(
    @Request() req,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const user = await this.usersService.updateOwnProfile(req.user.userId, dto, file);
    return {
      statusCode: HttpStatus.OK,
      message: 'Profile updated successfully',
      data: user,
    };
  }

  // Get all users with pagination and filtering (Admin only)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getAllUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('role') role?: Role,
    @Query('status') status?: UserStatus,
    @Query('search') search?: string,
  ) {
    const result = await this.usersService.findAll(page, limit, role, status, search);
    return {
      statusCode: HttpStatus.OK,
      message: 'Users retrieved successfully',
      data: result,
    };
  }

  // Get user by ID with addresses
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getUser(@Param('id') id: string, @Request() req) {
    // Users can view their own profile with addresses, admins can view any profile
    if (req.user.role !== Role.ADMIN && req.user.userId !== id) {
      throw new ForbiddenException('You can only view your own profile');
    }

    const user = await this.usersService.findByIdWithAddresses(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'User retrieved successfully',
      data: user,
    };
  }

  // Update user profile (user can update own, admin can update any)
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseGlobalFileInterceptor({ fieldName: 'image' })
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Request() req,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (req.user.role !== Role.ADMIN && req.user.userId !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // Non-admin users cannot update role and status
    if (req.user.role !== Role.ADMIN) {
      delete dto.role;
      delete dto.status;
    }

    const user = await this.usersService.updateUser(id, dto, file);
    return {
      statusCode: HttpStatus.OK,
      message: 'User updated successfully',
      data: user,
    };
  }

  // Admin only endpoints for user management
  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async approveUser(@Param('id') id: string) {
    const result = await this.usersService.updateStatus(id, UserStatus.APPROVED);
    return {
      statusCode: HttpStatus.OK,
      message: 'User approved successfully',
      data: result.user,
    };
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async rejectUser(@Param('id') id: string) {
    const result = await this.usersService.updateStatus(id, UserStatus.REJECTED);
    return {
      statusCode: HttpStatus.OK,
      message: 'User rejected successfully',
      data: result.user,
    };
  }

  @Patch(':id/toggle-block')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async toggleBlockUser(@Param('id') id: string) {
    const result = await this.usersService.toggleBlockUser(id);
    return {
      statusCode: HttpStatus.OK,
      message: result.message,
      data: result.user,
    };
  }

  @Patch(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async activateUser(@Param('id') id: string) {
    const result = await this.usersService.updateStatus(id, UserStatus.APPROVED);
    return {
      statusCode: HttpStatus.OK,
      message: 'User activated successfully',
      data: result.user,
    };
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async deactivateUser(@Param('id') id: string) {
    const result = await this.usersService.updateStatus(id, UserStatus.INACTIVE);
    return {
      statusCode: HttpStatus.OK,
      message: 'User deactivated successfully',
      data: result.user,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Param('id') id: string) {
    await this.usersService.deleteUser(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'User deleted successfully',
    };
  }

  @Get('stats/overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getUserStats() {
    const stats = await this.usersService.getUserStats();
    return {
      statusCode: HttpStatus.OK,
      message: 'User statistics retrieved successfully',
      data: stats,
    };
  }

  @Get('role/:role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getUsersByRole(@Param('role') role: Role) {
    const users = await this.usersService.findByRole(role);
    return {
      statusCode: HttpStatus.OK,
      message: 'Users retrieved successfully',
      data: users,
    };
  }

  @Get('status/:status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getUsersByStatus(@Param('status') status: UserStatus) {
    const users = await this.usersService.findByStatus(status);
    return {
      statusCode: HttpStatus.OK,
      message: 'Users retrieved successfully',
      data: users,
    };
  }
}
