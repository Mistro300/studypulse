import type { FastifyInstance } from 'fastify';
import { BatchReviewSyncInputSchema } from '@studypulse/shared';
import type { ApiEnv } from '../../config/env.js';
import type { DataRepository } from '../../core/db/repository.js';
import { createRequireAuth } from '../auth/auth.middleware.js';

export function registerStudyRoutes(
  fastify: FastifyInstance,
  repo: DataRepository,
  env: ApiEnv,
): void {
  const requireAuth = createRequireAuth(env);

  fastify.get('/api/study/queue', { preHandler: [requireAuth] }, async (request) => {
    const query = request.query as { deckId?: string; limit?: string };
    const limit = query.limit ? Math.min(100, Math.max(1, Number(query.limit) || 30)) : 30;
    return repo.getStudyQueue(request.authUser!.id, {
      ...(query.deckId ? { deckId: query.deckId } : {}),
      limit,
    });
  });

  fastify.post('/api/study/reviews/batch', { preHandler: [requireAuth] }, async (request) => {
    const input = BatchReviewSyncInputSchema.parse(request.body);
    return repo.recordReviewBatch(request.authUser!.id, input.events);
  });

  fastify.get('/api/analytics/overview', { preHandler: [requireAuth] }, async (request) => {
    return repo.getAnalyticsOverview(request.authUser!.id);
  });
}
