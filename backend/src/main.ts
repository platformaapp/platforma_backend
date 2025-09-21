import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 9000);

  app.use(cookieParser());
  app.setGlobalPrefix('api');

  await app.listen(port);
  console.log(`Application started on port ${port}`);
}
void bootstrap();
