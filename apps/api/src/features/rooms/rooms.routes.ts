import type { FastifyInstance } from 'fastify';
import type { Server as SocketIOServer } from 'socket.io';
import {
  AddMistakesToDeckInputSchema,
  CreateLiveRoomInputSchema,
  SubmitLiveAnswerInputSchema,
} from '@studypulse/shared';
import { z } from 'zod';
import type { ApiEnv } from '../../config/env.js';
import type { DataRepository } from '../../core/db/repository.js';
import { HttpError } from '../../core/errors/http-error.js';
import { verifyAccessToken } from '../../core/security/jwt.js';
import { createRequireAuth } from '../auth/auth.middleware.js';
import type { LiveRoomEngine } from './room-engine.js';

interface SocketAuthData {
  userId: string;
  email: string;
  displayName: string;
}

const MAX_SOCKET_EVENTS_PER_WINDOW = 30;
const SOCKET_WINDOW_MS = 10_000;

export function registerRoomRoutesAndSockets(
  fastify: FastifyInstance,
  io: SocketIOServer,
  repo: DataRepository,
  env: ApiEnv,
  engine: LiveRoomEngine,
): void {
  const requireAuth = createRequireAuth(env);

  // REST Endpoints
  fastify.get('/api/rooms', { preHandler: [requireAuth] }, async () => ({
    rooms: engine.listPublicRooms(),
  }));

  fastify.post('/api/rooms', { preHandler: [requireAuth] }, async (request, reply) => {
    const input = CreateLiveRoomInputSchema.parse(request.body);
    const user = await repo.findUserById(request.authUser!.id);
    if (!user) throw new HttpError(401, 'UNAUTHORIZED', 'User not found');

    const room = await engine.createRoom(
      { id: user.id, displayName: user.displayName },
      input,
    );
    return reply.status(201).send({ room });
  });

  fastify.get('/api/rooms/:code', { preHandler: [requireAuth] }, async (request) => {
    const { code } = request.params as { code: string };
    return { room: engine.getRoomSummary(code) };
  });

  fastify.post(
    '/api/rooms/:code/mistakes-deck',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const input = AddMistakesToDeckInputSchema.parse(request.body);
      const res = await engine.createMistakesReviewDeck(
        code,
        request.authUser!.id,
        input.cardIds,
        input.deckTitle,
      );
      return reply.status(201).send(res);
    },
  );

  // Socket.IO Handshake Authentication
  io.use(async (socket, next) => {
    const token =
      typeof socket.handshake.auth?.token === 'string'
        ? socket.handshake.auth.token
        : typeof socket.handshake.headers.authorization === 'string' &&
            socket.handshake.headers.authorization.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.slice(7).trim()
          : null;

    if (!token) {
      next(new Error('UNAUTHORIZED'));
      return;
    }

    const payload = verifyAccessToken(token, env.JWT_ACCESS_SECRET);
    if (!payload) {
      next(new Error('UNAUTHORIZED'));
      return;
    }

    const user = await repo.findUserById(payload.sub);
    if (!user) {
      next(new Error('UNAUTHORIZED'));
      return;
    }

    socket.data.auth = {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
    } satisfies SocketAuthData;
    next();
  });

  // Socket.IO Event Handlers with per-socket sliding window Rate Limiting
  io.on('connection', (socket) => {
    const auth = socket.data.auth as SocketAuthData | undefined;
    if (!auth) {
      socket.disconnect(true);
      return;
    }

    const eventTimestamps: number[] = [];
    const allowEvent = (): boolean => {
      const now = Date.now();
      while (eventTimestamps.length > 0 && now - eventTimestamps[0]! > SOCKET_WINDOW_MS) {
        eventTimestamps.shift();
      }
      if (eventTimestamps.length >= MAX_SOCKET_EVENTS_PER_WINDOW) {
        socket.emit('room:error', {
          code: 'RATE_LIMITED',
          message: 'Too many room events. Please slow down.',
        });
        return false;
      }
      eventTimestamps.push(now);
      return true;
    };

    const emitError = (err: unknown) => {
      if (err instanceof HttpError) {
        socket.emit('room:error', { code: err.code, message: err.message });
      } else {
        socket.emit('room:error', { code: 'INTERNAL_ERROR', message: 'Live room action failed' });
      }
    };

    socket.on('room:join', async (raw: unknown, ack?: (res: unknown) => void) => {
      if (!allowEvent()) return;
      try {
        const { code } = z.object({ code: z.string().min(4).max(8) }).parse(raw);
        const snapshot = await engine.joinRoom(
          socket,
          { id: auth.userId, displayName: auth.displayName },
          code,
        );
        socket.emit('room:snapshot', snapshot);
        ack?.({ ok: true, snapshot });
      } catch (err) {
        emitError(err);
        ack?.({ ok: false, error: err instanceof Error ? err.message : 'Join failed' });
      }
    });

    socket.on('room:resync', (raw: unknown, ack?: (res: unknown) => void) => {
      if (!allowEvent()) return;
      try {
        const { code } = z.object({ code: z.string().min(4).max(8) }).parse(raw);
        const snapshot = engine.buildSnapshotForUser(code, auth.userId);
        socket.emit('room:snapshot', snapshot);
        ack?.({ ok: true, snapshot });
      } catch (err) {
        emitError(err);
        ack?.({ ok: false });
      }
    });

    socket.on('room:ready', (raw: unknown) => {
      if (!allowEvent()) return;
      try {
        const { code } = z.object({ code: z.string().min(4).max(8) }).parse(raw);
        engine.toggleReady(code, auth.userId);
      } catch (err) {
        emitError(err);
      }
    });

    socket.on('room:bots:update', (raw: unknown) => {
      if (!allowEvent()) return;
      try {
        const { code, count } = z
          .object({ code: z.string().min(4).max(8), count: z.number().int().min(0).max(3) })
          .parse(raw);
        engine.updateSimulatedBots(code, auth.userId, count);
      } catch (err) {
        emitError(err);
      }
    });

    socket.on('room:start', (raw: unknown, ack?: (res: unknown) => void) => {
      if (!allowEvent()) return;
      try {
        const { code } = z.object({ code: z.string().min(4).max(8) }).parse(raw);
        engine.startRoom(code, auth.userId);
        ack?.({ ok: true });
      } catch (err) {
        emitError(err);
        ack?.({ ok: false, error: err instanceof Error ? err.message : 'Start failed' });
      }
    });

    socket.on('room:answer', (raw: unknown, ack?: (res: unknown) => void) => {
      if (!allowEvent()) return;
      try {
        const parsed = SubmitLiveAnswerInputSchema.parse(raw);
        const result = engine.submitAnswer(
          parsed.roomCode,
          auth.userId,
          parsed.questionIndex,
          parsed.choiceId,
        );
        ack?.({ ok: true, ...result });
      } catch (err) {
        emitError(err);
        ack?.({ ok: false });
      }
    });

    socket.on('disconnect', () => {
      engine.handleSocketDisconnect(socket.id);
    });
  });

  fastify.addHook('onClose', async () => {
    engine.shutdown();
    io.close();
  });
}
