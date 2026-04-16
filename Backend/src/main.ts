import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['http://localhost:3000'], // Allow frontend localhost
    methods: ['GET', 'POST'],
    credentials: true,
  });
  await app.listen(3001, 'localhost');
  console.log('Backend is running on http://localhost:3001');
}
bootstrap();
