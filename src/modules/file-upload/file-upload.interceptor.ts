import {
  CallHandler,
  ExecutionContext,
  Injectable,
  mixin,
  NestInterceptor,
  Type,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { Observable } from 'rxjs';
import * as multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

let multerS3: any;
try {
  multerS3 = require('multer-s3');
} catch (e) {
  Logger.warn(
    'multer-s3 package not installed. S3 uploads will be disabled.',
    'FileUploadInterceptor',
  );
}

export interface FileInterceptorOptions {
  fieldName?: string;
  maxCount?: number;
  allowedMimes?: RegExp;
  maxFileSizeBytes?: number;
}

const DEFAULT_ALLOWED_MIMES = /\/(jpg|jpeg|png|gif|webp|pdf|svg)$/i;
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function GlobalFileUploadInterceptor(
  options: FileInterceptorOptions = {},
): Type<NestInterceptor> {
  const fieldName = options.fieldName || 'file';
  const maxCount = options.maxCount ?? 1;
  const isSingle = maxCount === 1;

  @Injectable()
  class MixinInterceptor implements NestInterceptor {
    private readonly logger = new Logger('FileUploadInterceptor');
    private multerInstance: any;
    private storageInitialized = false;

    constructor(private readonly configService: ConfigService) {}

    private getMulterInstance() {
      if (this.multerInstance) {
        return this.multerInstance;
      }

      const storageType = this.configService.get<string>(
        'FILE_STORAGE',
        'local',
      );

      if (!this.storageInitialized) {
        this.logger.log(`Initializing ${storageType} storage`);
        this.storageInitialized = true;
      }

      let storage: multer.StorageEngine;

      if (storageType === 's3') {
        storage = this.createS3Storage();
      } else {
        storage = this.createLocalStorage();
      }

      const fileFilter = this.createFileFilter();
      const limits = this.createLimits();

      this.multerInstance = multer({ storage, limits, fileFilter });
      return this.multerInstance;
    }

    private createS3Storage(): multer.StorageEngine {
      const awsRegion = this.configService.get<string>('AWS_REGION');
      const awsAccessKey = this.configService.get<string>('AWS_ACCESS_KEY_ID');
      const awsSecretKey = this.configService.get<string>(
        'AWS_SECRET_ACCESS_KEY',
      );
      const awsBucket = this.configService.get<string>('AWS_S3_BUCKET');

      // Validate S3 configuration
      if (!awsRegion || !awsAccessKey || !awsSecretKey || !awsBucket) {
        this.logger.error(
          'Missing required S3 configuration. Falling back to local storage.',
        );
        return this.createLocalStorage();
      }

      if (!multerS3) {
        this.logger.error(
          'multer-s3 package not installed. Falling back to local storage.',
        );
        return this.createLocalStorage();
      }

      const s3 = new S3Client({
        region: awsRegion,
        credentials: {
          accessKeyId: awsAccessKey,
          secretAccessKey: awsSecretKey,
        },
      });

      return multerS3({
        s3,
        bucket: awsBucket,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: (req: any, file: any, cb: any) => {
          cb(null, {
            fieldName: file.fieldname,
            originalName: file.originalname,
            uploadedAt: new Date().toISOString(),
          });
        },
        key: (req: any, file: any, cb: any) => {
          const ext = path.extname(file.originalname).toLowerCase();
          const filename = `${randomUUID()}${ext}`;
          const s3Key = `uploads/${filename}`;
          cb(null, s3Key);
        },
      });
    }

    private createLocalStorage(): multer.StorageEngine {
      const localUploadPath = path.resolve(
        process.cwd(),
        this.configService.get<string>('LOCAL_UPLOAD_PATH', 'public/uploads'),
      );

      this.logger.log(`Local storage configured - Path: ${localUploadPath}`);

      // Ensure directory exists
      if (!fs.existsSync(localUploadPath)) {
        fs.mkdirSync(localUploadPath, { recursive: true });
        this.logger.log(`Created upload directory: ${localUploadPath}`);
      }

      return multer.diskStorage({
        destination: (req, file, cb) => cb(null, localUploadPath),
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase();
          const safeName = path
            .basename(file.originalname, ext)
            .replace(/[^a-z0-9]/gi, '-');
          const filename = `${Date.now()}-${safeName}${ext}`;
          cb(null, filename);
        },
      });
    }

    private createFileFilter(): multer.Options['fileFilter'] {
      const allowed = options.allowedMimes ?? DEFAULT_ALLOWED_MIMES;

      return (req, file, cb) => {
        if (allowed.test(file.mimetype)) {
          return cb(null, true);
        }

        this.logger.warn(
          `Rejected file: ${file.originalname} (mimetype: ${file.mimetype})`,
        );
        return cb(
          new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname),
        );
      };
    }

    private createLimits(): multer.Options['limits'] {
      return {
        fileSize: options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE,
        files: maxCount,
      };
    }

    async intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Promise<Observable<any>> {
      const httpContext = context.switchToHttp();
      const request = httpContext.getRequest();
      const response = httpContext.getResponse();

      const multerInstance = this.getMulterInstance();

      const uploadHandler = isSingle
        ? multerInstance.single(fieldName)
        : multerInstance.array(fieldName, maxCount);

      return new Promise((resolve, reject) => {
        uploadHandler(request, response, (error: any) => {
          if (error) {
            this.logger.error(`Upload failed: ${error.message}`, error.stack);
            return reject(error);
          }

          // Log upload success
          if (isSingle && request.file) {
            this.logger.log(
              `File uploaded - Name: ${request.file.originalname}, Size: ${request.file.size} bytes`,
            );
          } else if (!isSingle && request.files) {
            this.logger.log(
              `${request.files.length} file(s) uploaded - Total size: ${request.files.reduce((sum: number, f: any) => sum + f.size, 0)} bytes`,
            );
          }

          resolve(next.handle());
        });
      });
    }
  }

  return mixin(MixinInterceptor);
}
