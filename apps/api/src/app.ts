import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import type { ApiEnv } from './config/env.js';
import { MemoryRepository } from './core/db/memory-repository.js';
import { PrismaRepository } from './core/db/prisma-repository.js';
import type { DataRepository } from './core/db/repository.js';
import { globalErrorHandler } from './core/errors/error-handler.js';
import { registerAuthRoutes } from './features/auth/auth.routes.js';
import { registerDeckRoutes } from './features/decks/decks.routes.js';
import { LiveRoomEngine, type RoomEngineTimings } from './features/rooms/room-engine.js';
import { registerRoomRoutesAndSockets } from './features/rooms/rooms.routes.js';
import { registerSettingsRoutes } from './features/settings/settings.routes.js';
import { registerStudyRoutes } from './features/study/study.routes.js';

export interface BuiltApp {
  fastify: FastifyInstance;
  io: SocketIOServer;
  roomEngine: LiveRoomEngine;
  storageMode: 'prisma' | 'memory';
}

async function resolveRepository(
  env: ApiEnv,
  fastify: FastifyInstance,
  overrideRepo?: DataRepository,
): Promise<{ repo: DataRepository; storageMode: 'prisma' | 'memory' }> {
  if (overrideRepo) {
    return { repo: overrideRepo, storageMode: 'memory' };
  }

  if (env.API_STORAGE === 'memory' || env.NODE_ENV === 'test') {
    return { repo: await MemoryRepository.createWithSeed(), storageMode: 'memory' };
  }

  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    fastify.addHook('onClose', async () => {
      await prisma.$disconnect();
    });
    return { repo: new PrismaRepository(prisma), storageMode: 'prisma' };
  } catch (err) {
    await prisma.$disconnect().catch(() => undefined);
    if (env.API_STORAGE === 'prisma') {
      throw err;
    }
    fastify.log.warn(
      'PostgreSQL unreachable in development auto mode — falling back to seeded in-memory repository',
    );
    return { repo: await MemoryRepository.createWithSeed(), storageMode: 'memory' };
  }
}

export async function buildApp(
  env: ApiEnv,
  options?: { repository?: DataRepository; roomTimings?: Partial<RoomEngineTimings> },
): Promise<BuiltApp> {
  const fastify = Fastify({
    logger:
      env.NODE_ENV === 'test'
        ? false
        : {
            level: env.NODE_ENV === 'production' ? 'info' : 'debug',
          },
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xContentTypeOptions: true,
  });

  await fastify.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  });

  await fastify.register(cookie);

  await fastify.register(rateLimit, {
    max: env.NODE_ENV === 'test' ? 1000 : 120,
    timeWindow: '1 minute',
  });

  fastify.setErrorHandler(globalErrorHandler);

  const { repo, storageMode } = await resolveRepository(env, fastify, options?.repository);

  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'studypulse-api',
    storageMode,
    timestamp: new Date().toISOString(),
  }));

  registerAuthRoutes(fastify, repo, env);
  registerDeckRoutes(fastify, repo, env);
  registerStudyRoutes(fastify, repo, env);
  registerSettingsRoutes(fastify, repo, env);

  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    },
    pingInterval: 15_000,
    pingTimeout: 10_000,
  });

  const roomEngine = new LiveRoomEngine(io, repo, options?.roomTimings);
  registerRoomRoutesAndSockets(fastify, io, repo, env, roomEngine);

  return { fastify, io, roomEngine, storageMode };
}
