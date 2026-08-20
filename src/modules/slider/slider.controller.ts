import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UploadedFile,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { SliderService } from './slider.service';
import { UseGlobalFileInterceptor } from 'src/common/decorator/globalFileInterceptor.decorator';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/enum/user_role.enum';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';

@Controller('sliders')
export class SliderController {
  constructor(private readonly sliderService: SliderService) {}

  @Post()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseGlobalFileInterceptor({ fieldName: 'image' })
  async create(@UploadedFile() file: Express.Multer.File) {
    const slider = await this.sliderService.create(file);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Slider created successfully',
      data: slider,
    };
  }

  @Get()
  async findAll() {
    const sliders = await this.sliderService.findAll();
    return {
      statusCode: HttpStatus.OK,
      message: 'Sliders fetched successfully',
      data: sliders,
    };
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseGlobalFileInterceptor({ fieldName: 'image' })
  async update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const updated = await this.sliderService.update(id, file);
    return {
      statusCode: HttpStatus.OK,
      message: 'Slider updated successfully',
      data: updated,
    };
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async remove(@Param('id') id: string) {
    await this.sliderService.remove(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Slider deleted successfully',
    };
  }
}
