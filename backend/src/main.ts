import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/** Shared by bootstrap() and the integration tests so both run the same pipeline. */
export function configureApp(app: INestApplication) {
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  // No CORS: the frontend reaches the API same-origin through the Next.js /api rewrite.
  return app;
}

export async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in production');
  }
  const app = configureApp(await NestFactory.create(AppModule));
  await app.listen(process.env.PORT ?? 4000);
  return app;
}

if (require.main === module) {
  bootstrap();
}
