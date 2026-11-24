import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { NormalizedAppError } from '@studypulse/shared';
import { HttpError } from './http-error.js';

export function globalErrorHandler(
  error: FastifyError | HttpError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof HttpError) {
    const payload: NormalizedAppError = {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      statusCode: error.statusCode,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    };
    void reply.status(error.statusCode).send(payload);
    return;
  }

  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.') || '_root';
      const list = fieldErrors[path] ?? [];
      list.push(issue.message);
      fieldErrors[path] = list;
    }

    const payload: NormalizedAppError = {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request payload',
      retryable: false,
      statusCode: 400,
      fieldErrors,
    };
    void reply.status(400).send(payload);
    return;
  }

  const statusCode =
    'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;

  if (statusCode === 429) {
    const payload: NormalizedAppError = {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down.',
      retryable: true,
      statusCode: 429,
      retryAfterSec: 60,
    };
    void reply.status(429).send(payload);
    return;
  }

  if (statusCode >= 500) {
    request.log.error({ err: error }, 'Unhandled server error');
  }

  const code =
    statusCode === 401
      ? 'UNAUTHORIZED'
      : statusCode === 403
        ? 'FORBIDDEN'
        : statusCode === 404
          ? 'NOT_FOUND'
          : statusCode === 409
            ? 'CONFLICT'
            : 'INTERNAL_ERROR';

  const payload: NormalizedAppError = {
    code,
    message: statusCode >= 500 ? 'Internal server error' : error.message,
    retryable: statusCode >= 500,
    statusCode,
  };

  void reply.status(statusCode).send(payload);
}
