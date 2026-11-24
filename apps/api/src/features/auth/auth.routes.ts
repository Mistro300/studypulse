import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  LoginInputSchema,
  RegisterInputSchema,
  UpdateOnboardingInputSchema,
  type AuthSessionResponse,
  type UserProfile,
} from '@studypulse/shared';
import type { ApiEnv } from '../../config/env.js';
import type { DataRepository, StoredUser } from '../../core/db/repository.js';
import { DEMO_USER_EMAIL, DEMO_USER_PASSWORD } from '../../core/db/memory-repository.js';
import { HttpError } from '../../core/errors/http-error.js';
import {
  generateOpaqueToken,
  parseTtlToSeconds,
  sha256Hex,
  signAccessToken,
} from '../../core/security/jwt.js';
import { hashPassword, verifyPassword } from '../../core/security/password.js';
import { createRequireAuth } from './auth.middleware.js';

export const REFRESH_COOKIE_NAME = 'sp_refresh';

function toPublicUser(user: StoredUser): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    streakDays: user.streakDays,
    preferences: user.preferences,
  };
}

function setRefreshCookie(reply: FastifyReply, token: string, env: ApiEnv): void {
  const secure =
    env.COOKIE_SECURE || env.NODE_ENV === 'production' || env.COOKIE_SAME_SITE === 'none';
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/api/auth',
    maxAge: env.JWT_REFRESH_TTL_DAYS * 86400,
  });
}

function clearRefreshCookie(reply: FastifyReply, env: ApiEnv): void {
  const secure =
    env.COOKIE_SECURE || env.NODE_ENV === 'production' || env.COOKIE_SAME_SITE === 'none';
  reply.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/api/auth',
  });
}

export function registerAuthRoutes(
  fastify: FastifyInstance,
  repo: DataRepository,
  env: ApiEnv,
): void {
  const accessTtlSec = parseTtlToSeconds(env.JWT_ACCESS_TTL);
  const requireAuth = createRequireAuth(env);

  async function issueSession(
    user: StoredUser,
    request: FastifyRequest,
    reply: FastifyReply,
    familyId: string = randomUUID(),
    rotateFromTokenId?: string,
  ): Promise<AuthSessionResponse> {
    const rawRefresh = generateOpaqueToken();
    const tokenHash = sha256Hex(rawRefresh);
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86400 * 1000);
    const userAgent = request.headers['user-agent']?.slice(0, 250) ?? null;
    const ipAddress = request.ip ?? null;

    if (rotateFromTokenId) {
      await repo.rotateRefreshToken({
        oldTokenId: rotateFromTokenId,
        userId: user.id,
        familyId,
        newTokenHash: tokenHash,
        expiresAt,
        userAgent,
        ipAddress,
      });
    } else {
      await repo.createRefreshToken({
        userId: user.id,
        familyId,
        tokenHash,
        expiresAt,
        userAgent,
        ipAddress,
      });
    }

    setRefreshCookie(reply, rawRefresh, env);

    const accessToken = signAccessToken(
      { id: user.id, email: user.email },
      env.JWT_ACCESS_SECRET,
      accessTtlSec,
    );

    return {
      accessToken,
      expiresInSec: accessTtlSec,
      user: toPublicUser(user),
    };
  }

  fastify.post('/api/auth/register', async (request, reply) => {
    const input = RegisterInputSchema.parse(request.body);
    const existing = await repo.findUserByEmail(input.email);
    if (existing) {
      throw new HttpError(409, 'CONFLICT', 'An account with this email already exists', false, {
        email: ['Email is already registered'],
      });
    }

    const passwordHash = await hashPassword(input.password);
    const user = await repo.createUser({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      locale: input.locale,
    });

    const session = await issueSession(user, request, reply);
    return reply.status(201).send(session);
  });

  fastify.post('/api/auth/login', async (request, reply) => {
    const input = LoginInputSchema.parse(request.body);
    const user = await repo.findUserByEmail(input.email);
    if (!user || !user.passwordHash) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Invalid email or password');
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Invalid email or password');
    }

    const session = await issueSession(user, request, reply);
    return reply.status(200).send(session);
  });

  /**
   * 1-click Demo Login for Recruiter / Portfolio walkthroughs.
   * Ensures the seeded demo account exists even on fresh PostgreSQL databases.
   */
  fastify.post('/api/auth/demo', async (request, reply) => {
    let user = await repo.findUserByEmail(DEMO_USER_EMAIL);
    if (!user) {
      const passwordHash = await hashPassword(DEMO_USER_PASSWORD);
      user = await repo.createUser({
        email: DEMO_USER_EMAIL,
        passwordHash,
        displayName: 'Ahmed Mostafa',
        locale: 'ar',
      });
      user = await repo.updateUserOnboarding(user.id, {
        interests: ['Frontend', 'System Design', 'PWA'],
        dailyGoal: 20,
      });
    }

    const session = await issueSession(user, request, reply);
    return reply.status(200).send(session);
  });

  /**
   * Refresh Token Rotation with Family Reuse Detection.
   * If a revoked/rotated token is presented again, the entire token family is revoked immediately.
   */
  fastify.post('/api/auth/refresh', async (request, reply) => {
    const rawCookie = request.cookies[REFRESH_COOKIE_NAME];
    if (!rawCookie) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Refresh token missing');
    }

    const tokenHash = sha256Hex(rawCookie);
    const stored = await repo.findRefreshTokenByHash(tokenHash);
    if (!stored) {
      clearRefreshCookie(reply, env);
      throw new HttpError(401, 'UNAUTHORIZED', 'Invalid refresh token');
    }

    // Reuse detection: token was already rotated or explicitly revoked!
    if (stored.revokedAt) {
      request.log.warn(
        { userId: stored.userId, familyId: stored.familyId },
        'Refresh token reuse detected — revoking entire token family',
      );
      await repo.revokeRefreshTokenFamily(stored.familyId);
      clearRefreshCookie(reply, env);
      throw new HttpError(401, 'UNAUTHORIZED', 'Session revoked due to token reuse');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      await repo.revokeRefreshTokenFamily(stored.familyId);
      clearRefreshCookie(reply, env);
      throw new HttpError(401, 'UNAUTHORIZED', 'Refresh token expired');
    }

    const user = await repo.findUserById(stored.userId);
    if (!user) {
      await repo.revokeRefreshTokenFamily(stored.familyId);
      clearRefreshCookie(reply, env);
      throw new HttpError(401, 'UNAUTHORIZED', 'Account no longer exists');
    }

    const session = await issueSession(user, request, reply, stored.familyId, stored.id);
    return reply.status(200).send(session);
  });

  fastify.post('/api/auth/logout', async (request, reply) => {
    const rawCookie = request.cookies[REFRESH_COOKIE_NAME];
    if (rawCookie) {
      const stored = await repo.findRefreshTokenByHash(sha256Hex(rawCookie));
      if (stored) {
        await repo.revokeRefreshTokenFamily(stored.familyId);
      }
    }
    clearRefreshCookie(reply, env);
    return reply.status(200).send({ ok: true });
  });

  fastify.get('/api/auth/me', { preHandler: [requireAuth] }, async (request) => {
    const authUser = request.authUser!;
    const user = await repo.findUserById(authUser.id);
    if (!user) {
      throw new HttpError(401, 'UNAUTHORIZED', 'User not found');
    }
    return { user: toPublicUser(user) };
  });

  fastify.patch('/api/auth/onboarding', { preHandler: [requireAuth] }, async (request) => {
    const authUser = request.authUser!;
    const input = UpdateOnboardingInputSchema.parse(request.body);
    const updated = await repo.updateUserOnboarding(authUser.id, input);
    return { user: toPublicUser(updated) };
  });
}
