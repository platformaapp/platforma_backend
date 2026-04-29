import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { setupSwagger } from './config';
import { Request } from 'express';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import { join } from 'path';
import { mkdirSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  const uploadsDir = join('/app', 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  // Serve uploads at both paths: with and without /api/ prefix.
  // Some nginx configurations strip the /api/ prefix before proxying,
  // so we must handle both /uploads/* and /api/uploads/*.
  app.use('/uploads', express.static(uploadsDir));
  app.use('/api/uploads', express.static(uploadsDir));

  app.use(
    '/api/webhooks/yookassa',
    bodyParser.raw({
      type: 'application/json',
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = buf;
      },
      limit: '1mb',
    })
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: true,
      skipMissingProperties: true,
    })
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 9000);
  setupSwagger(app);

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  await app.listen(port);
  console.log(`Application started on port ${port}`);
}
void bootstrap();
