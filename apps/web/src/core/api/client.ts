import {
  AuthSessionResponseSchema,
  NormalizedAppErrorSchema,
  type AuthSessionResponse,
  type NormalizedAppError,
} from '@studypulse/shared';
import type { ZodType, ZodTypeDef } from 'zod';
import { useRateLimitStore } from '@/core/api/rate-limit-store';
import { isStandaloneMode } from '@/core/standalone/standalone-api';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || '';

export class ApiClientError extends Error {
  constructor(public readonly normalized: NormalizedAppError) {
    super(normalized.message);
    this.name = 'ApiClientError';
  }
}

let inMemoryAccessToken: string | null = null;
let refreshInFlight: Promise<AuthSessionResponse | null> | null = null;

type SessionExpiredHandler = () => void;
type TokenRefreshedHandler = (session: AuthSessionResponse) => void;

const sessionExpiredListeners = new Set<SessionExpiredHandler>();
const tokenRefreshedListeners = new Set<TokenRefreshedHandler>();

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function onSessionExpired(handler: SessionExpiredHandler): () => void {
  sessionExpiredListeners.add(handler);
  return () => sessionExpiredListeners.delete(handler);
}

export function onTokenRefreshed(handler: TokenRefreshedHandler): () => void {
  tokenRefreshedListeners.add(handler);
  return () => tokenRefreshedListeners.delete(handler);
}

function notifySessionExpired(): void {
  for (const listener of sessionExpiredListeners) {
    listener();
  }
}

function notifyTokenRefreshed(session: AuthSessionResponse): void {
  for (const listener of tokenRefreshedListeners) {
    listener(session);
  }
}

function resolveUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (!API_BASE) return path;
  // When running on localhost:5173 with Vite proxy, keep relative /api so SameSite=Strict cookies flow cleanly
  if (typeof window !== 'undefined' && window.location.port === '5173' && path.startsWith('/api')) {
    return path;
  }
  return `${API_BASE.replace(/\/$/, '')}${path}`;
}

async function parseErrorResponse(res: Response): Promise<NormalizedAppError> {
  try {
    const raw: unknown = await res.json();
    const parsed = NormalizedAppErrorSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
  } catch {
    // Fall through to generic HTTP mapping
  }

  return {
    code:
      res.status === 401
        ? 'UNAUTHORIZED'
        : res.status === 403
          ? 'FORBIDDEN'
          : res.status === 404
            ? 'NOT_FOUND'
            : res.status === 429
              ? 'RATE_LIMITED'
              : 'INTERNAL_ERROR',
    message: res.statusText || 'Request failed',
    retryable: res.status >= 500 || res.status === 429,
    statusCode: res.status,
  };
}

/**
 * Queued silent refresh: ensures concurrent 401 requests share ONE single /api/auth/refresh call.
 * Strictly separates network offline errors (throws NETWORK_OFFLINE) from server HTTP 401 (returns null).
 */
export async function performSilentRefresh(): Promise<AuthSessionResponse | null> {
  if (isStandaloneMode()) {
    try {
      const { handleStandaloneApiRequest } = await import('@/core/standalone/standalone-api');
      const raw = await handleStandaloneApiRequest('/api/auth/refresh', 'POST');
      const session = AuthSessionResponseSchema.parse(raw);
      inMemoryAccessToken = session.accessToken;
      notifyTokenRefreshed(session);
      return session;
    } catch {
      inMemoryAccessToken = null;
      return null;
    }
  }

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(resolveUrl('/api/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
      });

      if (res.status === 401) {
        inMemoryAccessToken = null;
        return null;
      }

      if (!res.ok) {
        const err = await parseErrorResponse(res);
        throw new ApiClientError(err);
      }

      const raw: unknown = await res.json();
      const session = AuthSessionResponseSchema.parse(raw);
      inMemoryAccessToken = session.accessToken;
      notifyTokenRefreshed(session);
      return session;
    } catch (err) {
      if (err instanceof ApiClientError) throw err;
      throw new ApiClientError({
        code: 'NETWORK_OFFLINE',
        message: 'Network unavailable while refreshing session',
        retryable: true,
      });
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export interface ApiRequestOptions<T> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  schema?: ZodType<T, ZodTypeDef, unknown>;
  signal?: AbortSignal;
  skipAuthRefresh?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions<T> = {},
): Promise<T> {
  const { method = 'GET', body, schema, signal, skipAuthRefresh = false } = options;

  if (isStandaloneMode()) {
    try {
      const { handleStandaloneApiRequest } = await import('@/core/standalone/standalone-api');
      const raw = await handleStandaloneApiRequest(path, method, body);
      return schema ? schema.parse(raw) : (raw as T);
    } catch (err) {
      const e = err as { statusCode?: number; code?: NormalizedAppError['code']; message?: string };
      throw new ApiClientError({
        code: e.code ?? 'INTERNAL_ERROR',
        message: e.message ?? 'Request failed',
        retryable: false,
        statusCode: e.statusCode ?? 400,
      });
    }
  }

  const execute = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (inMemoryAccessToken) {
      headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    }

    try {
      return await fetch(resolveUrl(path), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: 'include',
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      throw new ApiClientError({
        code: 'NETWORK_OFFLINE',
        message: 'Unable to reach StudyPulse server. You appear to be offline.',
        retryable: true,
      });
    }
  };

  let res = await execute();

  // Attempt queued silent token refresh on HTTP 401 (only for non-auth endpoints)
  if (res.status === 401 && !skipAuthRefresh && !path.startsWith('/api/auth/')) {
    const refreshed = await performSilentRefresh();
    if (refreshed) {
      res = await execute();
    } else {
      notifySessionExpired();
      throw new ApiClientError({
        code: 'UNAUTHORIZED',
        message: 'Your session expired. Please sign in again.',
        retryable: false,
        statusCode: 401,
      });
    }
  }

  if (!res.ok) {
    const normalized = await parseErrorResponse(res);
    if (normalized.code === 'RATE_LIMITED') {
      useRateLimitStore.getState().triggerRateLimit(normalized.retryAfterSec ?? 30);
    }
    throw new ApiClientError(normalized);
  }

  const raw: unknown = await res.json();
  return schema ? schema.parse(raw) : (raw as T);
}
