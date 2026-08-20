import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { FileUploadService } from './file-upload.service';
import { FileUploadExceptionFilter } from 'src/common/filters/file-upload-exception.filter';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    FileUploadService,
    {
      provide: APP_FILTER,
      useClass: FileUploadExceptionFilter,
    },
  ],
  exports: [FileUploadService],
})
export class FileUploadModule {}
