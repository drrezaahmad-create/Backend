import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FileUploadService } from '../../modules/file-upload/file-upload.service';
import { MongoServerError } from 'mongodb';

@Injectable()
@Catch() // catch-all on purpose
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly fileUploadService: FileUploadService) {}

  private getUploadedFiles(request: Request): Express.Multer.File[] {
    if ((request as any).file)
      return [(request as any).file as Express.Multer.File];
    const files = (request as any).files;
    if (files) {
      return Array.isArray(files)
        ? (files as Express.Multer.File[])
        : (Object.values(files).flat() as Express.Multer.File[]);
    }
    return [];
  }

  private async cleanupFiles(files: Express.Multer.File[]) {
    if (!files.length) return;
    // fileUploadService may be undefined if DI failed — guard it
    if (!this.fileUploadService) {
      this.logger.warn(
        'FileUploadService not available; skipping file cleanup.',
      );
      return;
    }
    await Promise.all(
      files.map(async (file) => {
        try {
          const location = (file as any)['location'] ?? file.path;
          if (location) {
            await this.fileUploadService.deleteFile(location);
          }
        } catch (e: any) {
          this.logger.error(`File cleanup error: ${e?.message ?? e}`);
        }
      }),
    );
  }

  async catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const uploadedFiles = this.getUploadedFiles(request);

    // Mongo duplicate key
    if (
      exception instanceof MongoServerError ||
      exception?.code === 11000 ||
      (typeof exception?.message === 'string' &&
        exception.message.includes('E11000'))
    ) {
      const keyValue = exception?.keyValue ?? {};
      const key = Object.keys(keyValue)[0] ?? 'field';
      const value = keyValue[key] ?? 'value';

      await this.cleanupFiles(uploadedFiles);
      return response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: `${key} '${value}' already exists.`,
        error: 'Conflict',
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    // HttpExceptions preserve their status code (e.g., 404 for wrong path)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : ((res as any)?.message ?? exception.message ?? 'Error');

      await this.cleanupFiles(uploadedFiles);
      return response.status(status).json({
        statusCode: status,
        message,
        error: exception.name,
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    // Unknown/unhandled errors — log full stack
    const errMsg = exception?.message ?? String(exception);
    const stack = exception?.stack ?? '';
    this.logger.error(`Unhandled exception: ${errMsg}`, stack);

    await this.cleanupFiles(uploadedFiles);
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'InternalServerError',
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
