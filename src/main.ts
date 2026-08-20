import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as express from 'express';

async function bootstrap() {
  // 👇 Important: disable Nest's built-in bodyParser completely first
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, //  this stops Nest from automatically parsing bodies
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;

  //  Apply raw body for Stripe webhook before any other parser
  app.use('/api/webhook/stripe', express.raw({ type: 'application/json' }));

  //  Then apply normal JSON parser for all other routes
  app.use(express.json({ limit: '10mb' }));

  // 🌐 Global prefix
  app.setGlobalPrefix('api', { exclude: ['/'] });

  //   Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  //  CORS
  //  CORS (production-safe with Cloudflare)
  const allowedDomainRegex =
    /^https?:\/\/([a-zA-Z0-9-]+\.)?(rnadental|rnasupplies)\.co\.uk$/;

  app.enableCors({
    origin: (origin, cb) => {
      // Allow server-to-server, Cloudflare worker, Postman, SSR requests
      if (!origin) return cb(null, true);

      // Allow localhost and EC2 IP for development/testing
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('13.134.227.59')) return cb(null, true);

      // Allow your production domains (including subdomains)
      if (allowedDomainRegex.test(origin)) return cb(null, true);

      // Other authorized domains
      const authorizedDomains = new Set([
        'https://dental-project-yctd.vercel.app',
      ]);

      if (authorizedDomains.has(origin)) return cb(null, true);

      console.error(`❌ CORS blocked: ${origin}`);
      return cb(new Error(`CORS blocked: ${origin}`), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  await app.listen(port);
  Logger.log(`🚀 Server running at http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
