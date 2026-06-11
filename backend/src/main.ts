import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:3107',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  await app.listen(8107);
  console.log('Application is running on: http://localhost:8107/api');
}
bootstrap();
