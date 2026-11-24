import type { FastifyInstance } from 'fastify';
import {
  PushSubscriptionInputSchema,
  UpdatePreferencesInputSchema,
} from '@studypulse/shared';
import { z } from 'zod';
import type { ApiEnv } from '../../config/env.js';
import type { DataRepository } from '../../core/db/repository.js';
import { createRequireAuth } from '../auth/auth.middleware.js';

export function registerSettingsRoutes(
  fastify: FastifyInstance,
  repo: DataRepository,
  env: ApiEnv,
): void {
  const requireAuth = createRequireAuth(env);
  const vapidPublicKey = env.VAPID_PUBLIC_KEY || null;

  fastify.patch('/api/settings/preferences', { preHandler: [requireAuth] }, async (request) => {
    const input = UpdatePreferencesInputSchema.parse(request.body);
    const updated = await repo.updateUserPreferences(request.authUser!.id, input);
    return {
      user: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        avatarUrl: updated.avatarUrl,
        streakDays: updated.streakDays,
        preferences: updated.preferences,
      },
    };
  });

  fastify.get('/api/push/status', { preHandler: [requireAuth] }, async (request) => {
    return repo.getPushStatus(request.authUser!.id, vapidPublicKey);
  });

  fastify.post('/api/push/subscribe', { preHandler: [requireAuth] }, async (request, reply) => {
    const sub = PushSubscriptionInputSchema.parse(request.body);
    const userAgent = request.headers['user-agent']?.slice(0, 250) ?? null;
    await repo.savePushSubscription(request.authUser!.id, sub, userAgent);
    const status = await repo.getPushStatus(request.authUser!.id, vapidPublicKey);
    return reply.status(201).send(status);
  });

  fastify.delete('/api/push/subscribe', { preHandler: [requireAuth] }, async (request) => {
    const { endpoint } = z.object({ endpoint: z.string().url() }).parse(request.body);
    await repo.deletePushSubscription(request.authUser!.id, endpoint);
    return repo.getPushStatus(request.authUser!.id, vapidPublicKey);
  });
}
