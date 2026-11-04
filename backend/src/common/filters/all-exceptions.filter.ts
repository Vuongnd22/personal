import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

interface ErrorBody {
  statusCode: number;
  message: string;
  errors?: { field: string; message: string }[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const body = this.toErrorBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }
    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown): ErrorBody {
    if (exception instanceof BadRequestException) {
      const payload = exception.getResponse();
      if (typeof payload === 'object' && payload !== null && 'message' in payload) {
        const messages = (payload as { message: unknown }).message;
        if (Array.isArray(messages) && messages.every((m) => typeof m === 'string')) {
          return {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Validation failed',
            errors: messages.map((m) => this.toFieldError(m)),
          };
        }
      }
      return { statusCode: HttpStatus.BAD_REQUEST, message: exception.message };
    }

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : typeof payload === 'object' && payload !== null && 'message' in payload
            ? String((payload as { message: unknown }).message)
            : exception.message;
      return { statusCode: exception.getStatus(), message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { statusCode: HttpStatus.CONFLICT, message: 'A record with this value already exists' };
      }
      if (exception.code === 'P2025') {
        return { statusCode: HttpStatus.NOT_FOUND, message: 'Resource not found' };
      }
    }

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }

  private toFieldError(message: string): { field: string; message: string } {
    const field = message.split(' ')[0] ?? 'value';
    return { field, message };
  }
}
