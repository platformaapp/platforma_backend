import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { swaggerCustomOptions } from './swagger.config';
import { ConfigService } from '@nestjs/config';

export function setupSwagger(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 9000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  const config = new DocumentBuilder()
    .setTitle('Platforma API')
    .setDescription('API documentation for Platforma application')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth'
    );

  if (nodeEnv === 'production') {
    config.addServer('http://91.229.9.117:3000/api', 'Production Server');
  } else {
    config.addServer(`http://localhost:${port}/api`, 'Local Server');
  }

  const document = SwaggerModule.createDocument(app, config.build());

  SwaggerModule.setup('api/docs', app, document, {
    ...swaggerCustomOptions,
    customSiteTitle: `Platforma API - ${nodeEnv.toUpperCase()}`,
  });

  if (nodeEnv === 'production') {
    console.log(`📖 Production Swagger: http://91.229.9.117:3000/api/docs`);
  } else {
    console.log(`📖 Local Swagger: http://localhost:${port}/api/docs`);
  }

  console.log(`✅ Swagger enabled for ${nodeEnv} environment`);
}
