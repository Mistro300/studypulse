import Dexie, { type Table } from 'dexie';
import type {
  CachedSessionProfile,
  CardChoice,
  CardType,
  Locale,
  SrsRating,
  SrsState,
} from '@studypulse/shared';

export interface OfflineDeckRecord {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  topic: string;
  language: Locale;
  isPublic: boolean;
  cardCount: number;
  downloadedAt: string;
  updatedAt: string;
}

export interface OfflineCardRecord {
  id: string;
  deckId: string;
  type: CardType;
  front: string;
  back: string;
  explanation: string | null;
  choices: CardChoice[] | null;
  correctChoiceId: string | null;
  tags: string[];
  updatedAt: string;
}

export interface LocalSrsStateRecord {
  /** Composite primary key `${userId}:${cardId}` */
  key: string;
  userId: string;
  cardId: string;
  deckId: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: SrsState;
  lastReview: string | null;
  updatedAt: string;
}

export type SyncOutboxStatus = 'PENDING' | 'SYNCING' | 'CONFLICT' | 'FAILED';

export type SyncOutboxKind = 'REVIEW_EVENT' | 'CARD_UPDATE' | 'DECK_UPDATE';

export interface SyncOutboxRecord {
  idempotencyKey: string;
  userId: string;
  kind: SyncOutboxKind;
  entityId: string;
  payload: Record<string, unknown>;
  clientTimestamp: string;
  status: SyncOutboxStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

export interface CachedSessionProfileRecord extends CachedSessionProfile {
  /** Singleton key 'current' */
  id: 'current';
}

export interface ReviewOutboxPayload {
  cardId: string;
  deckId: string;
  rating: SrsRating;
  durationMs: number;
  clientTimestamp: string;
}

export class StudyPulseOfflineDB extends Dexie {
  offline_decks!: Table<OfflineDeckRecord, string>;
  offline_cards!: Table<OfflineCardRecord, string>;
  local_srs_states!: Table<LocalSrsStateRecord, string>;
  sync_outbox!: Table<SyncOutboxRecord, string>;
  cached_session_profile!: Table<CachedSessionProfileRecord, string>;

  constructor() {
    super('studypulse_offline_v1');

    this.version(1).stores({
      offline_decks: 'id, ownerId, topic, updatedAt',
      offline_cards: 'id, deckId, type, updatedAt',
      local_srs_states: 'key, [userId+due], [userId+deckId], cardId',
      sync_outbox: 'idempotencyKey, [userId+status], kind, createdAt',
      cached_session_profile: 'id, userId',
    });
  }
}

export const offlineDb = new StudyPulseOfflineDB();

/**
 * Mandatory security routine invoked on explicit user logout.
 * Clears all IndexedDB tables and browser runtime caches so shared devices never leak user data.
 */
export async function clearAllLocalUserData(): Promise<void> {
  await Promise.all([
    offlineDb.offline_decks.clear(),
    offlineDb.offline_cards.clear(),
    offlineDb.local_srs_states.clear(),
    offlineDb.sync_outbox.clear(),
    offlineDb.cached_session_profile.clear(),
  ]);

  if (typeof window !== 'undefined' && 'caches' in window) {
    const cacheNames = await window.caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith('studypulse-'))
        .map((name) => window.caches.delete(name)),
    );
  }
}
