import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '3001', 10);
const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '3000', 10);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      `http://localhost:${FRONTEND_PORT}`,
      `http://127.0.0.1:${FRONTEND_PORT}`,
    ],
    credentials: true,
    exposedHeaders: ['x-user-id', 'x-user-name', 'x-user-role'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('团购订单系统 API')
    .setDescription('社区团购平台月底集中处理团购订单系统 API 文档')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(BACKEND_PORT);
  console.log(`Backend is running on http://localhost:${BACKEND_PORT}`);
  console.log(`Swagger API docs: http://localhost:${BACKEND_PORT}/api`);
}
bootstrap();
