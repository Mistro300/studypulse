import type { Redis } from 'ioredis';
import {
  RedisLiveRoomStateSchema,
  type RedisLiveRoomState,
} from '@studypulse/shared';

export const REDIS_ROOM_KEY_PREFIX = 'studypulse:room:';
export const REDIS_ACTIVE_ROOMS_SET = 'studypulse:rooms:public';

/** Sliding TTL for active rooms (2 hours) and finished rooms (15 minutes) */
export const ACTIVE_ROOM_TTL_SECONDS = 2 * 60 * 60;
export const FINISHED_ROOM_TTL_SECONDS = 15 * 60;

export function roomStateKey(code: string): string {
  return `${REDIS_ROOM_KEY_PREFIX}${code.toUpperCase()}`;
}

export class RedisRoomStateStore {
  constructor(private readonly redis: Redis) {}

  async save(state: RedisLiveRoomState): Promise<void> {
    const parsed = RedisLiveRoomStateSchema.parse(state);
    const key = roomStateKey(parsed.code);
    const ttl =
      parsed.phase === 'FINISHED' ? FINISHED_ROOM_TTL_SECONDS : ACTIVE_ROOM_TTL_SECONDS;

    const tx = this.redis.multi();
    tx.set(key, JSON.stringify(parsed), 'EX', ttl);
    if (parsed.isPublic && parsed.phase !== 'FINISHED') {
      tx.sadd(REDIS_ACTIVE_ROOMS_SET, parsed.code);
    } else {
      tx.srem(REDIS_ACTIVE_ROOMS_SET, parsed.code);
    }
    await tx.exec();
  }

  async get(code: string): Promise<RedisLiveRoomState | null> {
    const raw = await this.redis.get(roomStateKey(code));
    if (!raw) return null;
    const json: unknown = JSON.parse(raw);
    return RedisLiveRoomStateSchema.parse(json);
  }

  async delete(code: string): Promise<void> {
    const normalized = code.toUpperCase();
    await this.redis
      .multi()
      .del(roomStateKey(normalized))
      .srem(REDIS_ACTIVE_ROOMS_SET, normalized)
      .exec();
  }
}
