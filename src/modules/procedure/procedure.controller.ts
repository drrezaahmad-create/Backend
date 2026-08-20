import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UploadedFile,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import { PaginationParamsDto } from 'src/modules/procedure/dto/pagination-params.dto';
import { ProceduresService } from './procedure.service';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { UseGlobalFileInterceptor } from '../../common/decorator/globalFileInterceptor.decorator';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/enum/user_role.enum';
import { JwtAuthGuard } from 'src/common/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';

@Controller('procedures')
export class ProceduresController {
  constructor(private readonly proceduresService: ProceduresService) {}

  @Post()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseGlobalFileInterceptor({ fieldName: 'image' })
  async create(
    @Body() dto: CreateProcedureDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const procedure = await this.proceduresService.create(dto, file);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Procedure created successfully',
      data: procedure,
    };
  }

  @Get()
  async findAll(@Query() paginationParams: PaginationParamsDto) {
    const { data, pagination } = await this.proceduresService.findAll(paginationParams);
    return {
      statusCode: HttpStatus.OK,
      message: 'Procedures fetched successfully',
      data,
      pagination,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const procedure = await this.proceduresService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Procedure fetched successfully',
      data: procedure,
    };
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseGlobalFileInterceptor({ fieldName: 'image' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProcedureDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const updated = await this.proceduresService.update(id, dto, file);
    return {
      statusCode: HttpStatus.OK,
      message: 'Procedure updated successfully',
      data: updated,
    };
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async remove(@Param('id') id: string) {
    await this.proceduresService.remove(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Procedure deleted successfully',
    };
  }
}
