import { PartialType } from '@nestjs/mapped-types';
import { CreateGlobalSearchDto } from './create-global-search.dto';

export class UpdateGlobalSearchDto extends PartialType(CreateGlobalSearchDto) {}
