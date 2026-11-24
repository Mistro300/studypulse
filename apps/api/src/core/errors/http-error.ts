import type { NormalizedErrorCode } from '@studypulse/shared';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: NormalizedErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
