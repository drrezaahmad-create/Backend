import {
  Controller,
  Post,
  Patch,
  Body,
  Req,
  UseGuards,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupAuthDto } from './dto/signup-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { RefreshTokenGuard } from 'src/common/guard/refresh-token.guard';
import { UseGlobalFileInterceptor } from 'src/common/decorator/globalFileInterceptor.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @UseGlobalFileInterceptor({ fieldName: 'image' })
  async signup(
    @Body() dto: SignupAuthDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const result = await this.authService.signup(dto, file);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Account created successfully,',
      data: result,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginAuthDto) {
    const tokens = await this.authService.login(dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Login successful',
      data: tokens,
    };
  }

  @Post('forgot')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'OTP sent to your email successfully',
    };
  }

  // Email verification flows (separate from password-reset OTP)
  @Post('email/send-otp')
  @HttpCode(HttpStatus.OK)
  async sendEmailVerificationOtp(@Body() dto: { email: string }) {
    await this.authService.sendEmailVerificationOtp(dto.email);
    return {
      statusCode: HttpStatus.OK,
      message: 'Verification OTP sent',
    };
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyOtpDto) {
    await this.authService.verifyEmailOtp(dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Email verified successfully',
    };
  }

  // Password-reset OTP verification (returns resetToken)
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const result = await this.authService.verifyOtp(dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'OTP verified successfully',
      data: result, // { resetToken }
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Password reset successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(req.user.userId, dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Password changed successfully. Please log in again.',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any) {
    await this.authService.logout(req.user.userId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Logged out successfully',
    };
  }

  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: any) {
    const tokens = await this.authService.refreshTokens(
      req.user.userId,
      req.user.refreshToken,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Tokens refreshed successfully',
      data: tokens,
    };
  }
}
