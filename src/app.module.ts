import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DomainModule } from 'src/modules/domain.module';
import { MongooseDatabaseModule } from 'src/common/database/mongoose.module';
import { ConfigModule } from '@nestjs/config';
import { FileUploadModule } from 'src/modules/file-upload/file-upload.module';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from 'src/common/filters/all-exception.filter';

const importsArray: any[] = [
  ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
  MongooseDatabaseModule,
  FileUploadModule,
  DomainModule,
];

// Only serve static files if using local storage
if (process.env.FILE_STORAGE === 'local') {
  importsArray.push(
    ServeStaticModule.forRoot({
      rootPath: path.resolve(process.cwd(), 'public'),
      serveRoot: '/',
      exclude: ['/api*'],
    }),
  );
}

@Module({
  imports: importsArray,
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
