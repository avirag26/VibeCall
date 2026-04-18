import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Get port from environment or default to 3001
  const port = process.env.PORT || 3001;
  
  // Enable CORS for all origins (Render deployment)
  app.enableCors({
    origin: true, // Allow all origins
    methods: ['GET', 'POST'],
    credentials: true,
  });
  
  // Listen on 0.0.0.0 for Render, localhost for local dev
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
  
  await app.listen(port, host);
  console.log(`Backend is running on http://${host}:${port}`);
}
bootstrap();
