import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

@Catch(MulterError)
export class FileUploadExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(FileUploadExceptionFilter.name);

  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.BAD_REQUEST;
    let message = 'File upload failed';
    let error = 'FILE_UPLOAD_ERROR';

    // Map Multer errors to user-friendly messages
    switch (exception.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size exceeds the maximum allowed limit (10MB)';
        error = 'FILE_TOO_LARGE';
        break;

      case 'LIMIT_FILE_COUNT':
        message = 'Too many files uploaded. Maximum allowed limit exceeded.';
        error = 'TOO_MANY_FILES';
        break;

      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Invalid file type. Only images and PDFs are allowed.';
        error = 'INVALID_FILE_TYPE';
        break;

      case 'LIMIT_FIELD_KEY':
        message = 'Field name too long';
        error = 'FIELD_NAME_TOO_LONG';
        break;

      case 'LIMIT_FIELD_VALUE':
        message = 'Field value too long';
        error = 'FIELD_VALUE_TOO_LONG';
        break;

      case 'LIMIT_FIELD_COUNT':
        message = 'Too many fields';
        error = 'TOO_MANY_FIELDS';
        break;

      case 'LIMIT_PART_COUNT':
        message = 'Too many parts';
        error = 'TOO_MANY_PARTS';
        break;

      default:
        message = exception.message || 'File upload failed';
        error = 'UPLOAD_ERROR';
    }

    this.logger.warn(
      `File upload error - Code: ${exception.code}, Path: ${request.url}, Message: ${message}`,
    );

    response.status(status).json({
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
