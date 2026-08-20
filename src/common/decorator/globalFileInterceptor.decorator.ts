import { applyDecorators, UseInterceptors } from '@nestjs/common';
import {
  FileInterceptorOptions,
  GlobalFileUploadInterceptor,
} from 'src/modules/file-upload/file-upload.interceptor';

export function UseGlobalFileInterceptor(
  options: FileInterceptorOptions = { fieldName: 'file' },
) {
  return applyDecorators(UseInterceptors(GlobalFileUploadInterceptor(options)));
}
