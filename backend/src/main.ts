import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { setupSwagger } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 9000);
  setupSwagger(app);

  app.use(cookieParser());
  app.setGlobalPrefix('api');

  await app.listen(port);
  console.log(`Application started on port ${port}`);
}
void bootstrap();
