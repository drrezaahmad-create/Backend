import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserDocument } from '../users/schema/user.schema';
import { UsersService } from 'src/modules/users/users.service';
import { MailService } from 'src/modules/mail/mail.service';
import { FileUploadService } from 'src/modules/file-upload/file-upload.service';
import { NotificationService } from 'src/modules/notification/notification.service';
import { SignupAuthDto } from './dto/signup-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

import { UserStatus } from 'src/common/enum/user.status.enum';
import { Role } from 'src/common/enum/user_role.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly otpExpiryMs: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly notificationService: NotificationService,
    private readonly fileUploadService: FileUploadService,
    private readonly mailService: MailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectConnection() private readonly connection: Connection,
  ) {
    this.otpExpiryMs =
      (+this.config.get<number>('OTP_EXPIRATION_MINUTES')! || 15) * 60 * 1000;
  }

  /* =======================
   * Helpers
   * ======================= */
  private sanitize(user: UserDocument) {
    const { password, refreshToken, ...safe } = user.toObject({
      getters: true,
      virtuals: false,
    });
    return safe;
  }

  private async signTokens(userId: string, email: string, role: string | Role) {
    const payload = { userId, email, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACC_EXPIRATION'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REF_EXPIRATION'),
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
  }

  /* =======================
   * Signup & Email Verification
   * ======================= */
  async signup(dto: SignupAuthDto, file?: Express.Multer.File) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const existing = await this.usersService.findByEmail(dto.email);
      if (existing) {
        throw new ForbiddenException({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Email already exists',
        });
      }

      const passwordHash = await bcrypt.hash(dto.password, 10);

      let imageUrl: string | undefined;
      if (file) {
        // implement FileUploadService.handleUpload to return a public URL
        imageUrl = await this.fileUploadService.handleUpload(file);
      }

      // Create user as PENDING (admin approval) and not verified (email)
      const user: UserDocument = await this.usersService.createUser(
        {
          ...dto,
          password: passwordHash,
          imageUrl,
          status: UserStatus.APPROVED,
          isVerified: false,
        },
        session,
      );

      // Generate email verification OTP
      const code = this.generateCode();
      user.emailVerificationCodeHash = await bcrypt.hash(code, 10);
      user.emailVerificationExpires = new Date(Date.now() + this.otpExpiryMs);
      await user.save({ session });

      // Send verification email (don’t fail signup if email send fails)
      try {
        await this.mailService.sendEmailVerificationOtp(user.email, code);
      } catch (err) {
        // If email fails, we might want to abort transaction?
        // Current requirement says "don't fail signup", so we keep it.
        // But if we wanted strict consistency, we would throw here.
        this.logger.error('Failed to send verification email', err);
      }

      await session.commitTransaction();

      // Notify admins about new signup (outside transaction as it's not critical for data integrity)
      try {
        const admins = await this.usersService.findAllByRole(Role.ADMIN);
        await Promise.all(
          admins.map((admin) =>
            this.notificationService.createNotification({
              title: 'New signup',
              body: `${user.email} has signed up and needs approval.`,
              user: admin.id,
              metadata: { signup: true, newUserId: user.id },
            }),
          ),
        );
      } catch {
        // swallow admin notification errors
      }

      return { user: this.sanitize(user) };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async sendEmailVerificationOtp(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User not found',
      });
    }

    // regenerate & store code
    const code = this.generateCode();
    user.emailVerificationCodeHash = await bcrypt.hash(code, 10);
    user.emailVerificationExpires = new Date(Date.now() + this.otpExpiryMs);
    await user.save();

    await this.mailService.sendEmailVerificationOtp(email, code);
  }

  async verifyEmailOtp(dto: VerifyOtpDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (
      !user ||
      !user.emailVerificationCodeHash ||
      !user.emailVerificationExpires
    ) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message:
          'Verification code not found or expired. Please request a new code',
      });
    }

    if (user.emailVerificationExpires < new Date()) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Verification code has expired. Please request a new code',
      });
    }

    const ok = await bcrypt.compare(
      dto.code.toString(),
      user.emailVerificationCodeHash,
    );
    if (!ok) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid verification code',
      });
    }

    user.isVerified = true;
    user.emailVerifiedAt = new Date();
    user.emailVerificationCodeHash = null;
    user.emailVerificationExpires = null;
    await user.save();

    // Optional: notify user or admins
    try {
      await this.mailService.sendEmail(
        user.email,
        'Email verified',
        'Your email has been successfully verified.',
      );
    } catch {
      // ignore
    }

    return { message: 'Email verified' };
  }


   // Login / Tokens / Logout

  async login(dto: LoginAuthDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Invalid email or password',
      });
    }

    // Account status checks
    switch (user.status) {
      case UserStatus.PENDING:
        throw new UnauthorizedException({
          statusCode: HttpStatus.UNAUTHORIZED,
          message: 'Your account is pending approval by administrator',
        });
      case UserStatus.REJECTED:
        throw new UnauthorizedException({
          statusCode: HttpStatus.UNAUTHORIZED,
          message:
            'Your account has been rejected. Please contact administrator',
        });
      case UserStatus.BLOCKED:
        throw new UnauthorizedException({
          statusCode: HttpStatus.UNAUTHORIZED,
          message:
            'Your account has been blocked. Please contact administrator',
        });
    }

    // Require verified email (optional but recommended)
    if (!user.isVerified) {
      throw new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Please verify your email address to continue',
      });
    }

    const tokens = await this.signTokens(user.id, user.email, user.role);
    await this.usersService.updateRefreshToken(
      user.id,
      await bcrypt.hash(tokens.refreshToken, 10),
    );

    return tokens;
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshToken) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Access Denied - Invalid refresh token',
      });
    }

    // status check
    if (user.status !== UserStatus.APPROVED) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        message: `Account is ${user.status.toLowerCase()}. Access denied`,
      });
    }

    const match = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!match) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Invalid refresh token',
      });
    }

    const tokens = await this.signTokens(user.id, user.email, user.role);
    await this.usersService.updateRefreshToken(
      user.id,
      await bcrypt.hash(tokens.refreshToken, 10),
    );
    return tokens;
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  // Change Password (auth)
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User not found',
      });
    }

    const match = await bcrypt.compare(dto.currentPassword, user.password);
    if (!match) {
      throw new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Current password is incorrect',
      });
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'New password must be different from current password',
      });
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    user.refreshToken = null; // revoke all sessions
    await user.save();

    try {
      await this.mailService.sendEmail(
        user.email,
        'Your password was changed',
        'Your password has been updated. If this wasn’t you, reset it immediately and contact support.',
      );
    } catch {
      // do not block on email failure
    }

    return { message: 'Password changed' };
  }

  /* =======================
   * Password Reset (OTP + Reset Token)
   * ======================= */
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'No account found with this email address',
      });
    }

    if (
      user.status === UserStatus.BLOCKED ||
      user.status === UserStatus.REJECTED
    ) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        message: `Cannot reset password. Account is ${user.status.toLowerCase()}`,
      });
    }

    const code = this.generateCode();
    user.resetPasswordCodeHash = await bcrypt.hash(code, 10);
    user.resetPasswordExpires = new Date(Date.now() + this.otpExpiryMs);
    await user.save();

    await this.mailService.sendResetPasswordOtp(dto.email, code);
    return { message: 'OTP sent to your email' };
  }

  // Verify reset OTP → returns a short-lived reset token
  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.resetPasswordCodeHash || !user.resetPasswordExpires) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'OTP not found or expired. Please request a new OTP',
      });
    }

    if (user.resetPasswordExpires < new Date()) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'OTP has expired. Please request a new OTP',
      });
    }

    const match = await bcrypt.compare(
      dto.code.toString(),
      user.resetPasswordCodeHash,
    );
    if (!match) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid OTP. Please check the code and try again',
      });
    }

    const payload = { sub: user.id, email: user.email };
    const resetToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_RESET_SECRET'),
      // keep expiry short; if you want different duration, add JWT_RESET_EXPIRATION in env
      expiresIn: this.config.get<string>('JWT_ACC_EXPIRATION'),
    });

    // Clear OTP so it can’t be reused
    user.resetPasswordCodeHash = null;
    user.resetPasswordExpires = null;
    await user.save();

    return { resetToken };
  }

  async resetPassword(dto: ResetPasswordDto) {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(dto.resetToken, {
        secret: this.config.get<string>('JWT_RESET_SECRET'),
      });
    } catch {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message:
          'Invalid or expired reset token. Please request a new password reset',
      });
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User account no longer exists',
      });
    }

    if (
      user.status === UserStatus.BLOCKED ||
      user.status === UserStatus.REJECTED
    ) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        message: `Cannot reset password. Account is ${user.status.toLowerCase()}`,
      });
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    user.refreshToken = null; // revoke sessions
    await user.save();

    return { message: 'Password reset successful' };
  }
}
