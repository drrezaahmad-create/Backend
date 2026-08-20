import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/enum/user_role.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('')
  getHello(): string {
    return this.appService.getHello();
  }

  @Roles(Role.DENTIST)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('dashboard')
  getDashboard(): string {
    return this.appService.getDashboard();
  }
}
