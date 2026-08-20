import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as fssync from 'fs';
import * as path from 'path';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly useS3: boolean;
  private readonly localUploadPath: string;
  private readonly s3?: S3Client;
  private readonly s3Bucket?: string;
  private readonly publicBaseUrl?: string;

  constructor(private readonly config: ConfigService) {
    this.useS3 = this.config.get<string>('FILE_STORAGE', 'local') === 's3';
    this.localUploadPath = path.resolve(
      process.cwd(),
      this.config.get<string>('LOCAL_UPLOAD_PATH', 'public/uploads'),
    );
    this.publicBaseUrl =
      this.config.get<string>('FILE_PUBLIC_BASE_URL') ?? undefined;

    if (this.useS3) {
      this.s3 = new S3Client({
        region: this.config.get<string>('AWS_REGION')!,
        credentials: {
          accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID')!,
          secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY')!,
        },
      });
      this.s3Bucket = this.config.get<string>('AWS_S3_BUCKET')!;
    }

    // Ensure local dir exists at boot (for local mode)
    if (!this.useS3) {
      if (!fssync.existsSync(this.localUploadPath)) {
        fssync.mkdirSync(this.localUploadPath, { recursive: true });
      }
    }
  }

  /**
   * Upload a single file that arrived via Multer.
   * When using multer-s3, the file is already uploaded to S3 and we just return the URL.
   * For local: file is already saved to disk and we return the URL.
   */
  async handleUpload(file: Express.Multer.File): Promise<string> {
    if (!file) throw new BadRequestException('No file received');

    try {
      if (this.useS3) {
        // With multer-s3, the file is already uploaded to S3
        // multer-s3 adds 'location' and 'key' properties to the file object
        const s3File = file as any;

        if (s3File.location) {
          this.logger.log('✅ Returning S3 location:', s3File.location);
          return s3File.location; // S3 URL provided by multer-s3
        }

        if (s3File.key) {
          const url = this.publicUrlForKey(s3File.key);
          this.logger.log('✅ Constructed S3 URL:', url);
          return url;
        }

        // This shouldn't happen if multer-s3 is working
        throw new Error(
          `S3 upload failed. File has: ${Object.keys(file).join(', ')}. Expected 'location' or 'key' from multer-s3.`,
        );
      }

      // Local mode - file is already on disk via multer.diskStorage
      if (file.path) {
        return this.publicUrlForLocal(path.basename(file.path));
      }

      if (file.filename) {
        return this.publicUrlForLocal(file.filename);
      }

      throw new Error('No file data available');
    } catch (err: any) {
      this.logger.error('❌ File upload error:', err.message);
      throw new InternalServerErrorException(
        err.message || 'Failed to process file upload',
      );
    }
  }

  /**
   * Delete a file by URL or key (S3) or by public path/local path (local).
   */
  async deleteFile(fileIdentifier: string): Promise<void> {
    if (!fileIdentifier) return;

    try {
      if (this.useS3) {
        const key = this.extractS3Key(fileIdentifier);
        await this.s3!.send(
          new DeleteObjectCommand({
            Bucket: this.s3Bucket!,
            Key: key,
          }),
        );
        return;
      }

      // Local
      const filePath = this.resolveLocalPath(fileIdentifier);
      await fs.unlink(filePath);
    } catch (err: any) {
      // Ignore not-found deletes
      if (err?.code === 'ENOENT' || err?.name === 'NoSuchKey') return;
      throw new InternalServerErrorException('File deletion failed');
    }
  }

  // -------- Private helpers --------

  private publicUrlForLocal(fileName: string) {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/+$/, '')}/uploads/${encodeURIComponent(fileName)}`;
    }
    return `/uploads/${encodeURIComponent(fileName)}`;
  }

  private publicUrlForKey(key: string) {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/+$/, '')}/${encodeURIComponent(key)}`;
    }
    // Default S3 URL
    return `https://${this.s3Bucket}.s3.${this.config.get('AWS_REGION')}.amazonaws.com/${encodeURIComponent(key)}`;
  }

  private extractS3Key(input: string) {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      const url = new URL(input);
      return decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    }
    return input;
  }

  private resolveLocalPath(identifier: string) {
    let fileName: string;

    if (identifier.startsWith('/uploads/')) {
      fileName = path.basename(identifier);
    } else {
      fileName = path.basename(identifier);
    }

    const joined = path.join(this.localUploadPath, fileName);
    const normalized = path.normalize(joined);

    if (!normalized.startsWith(path.normalize(this.localUploadPath))) {
      throw new BadRequestException('Invalid file path');
    }

    return normalized;
  }
}
