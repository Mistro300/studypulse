import type { FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { ApiEnv } from '../../config/env.js';
import { HttpError } from '../../core/errors/http-error.js';
import { verifyAccessToken } from '../../core/security/jwt.js';

export interface AuthContextUser {
  id: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthContextUser;
  }
}

export function createRequireAuth(env: ApiEnv): preHandlerHookHandler {
  return async (request: FastifyRequest): Promise<void> => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const payload = verifyAccessToken(token, env.JWT_ACCESS_SECRET);
    if (!payload) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Access token is invalid or expired');
    }

    request.authUser = { id: payload.sub, email: payload.email };
  };
}
