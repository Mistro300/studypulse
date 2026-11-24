import { randomUUID } from 'node:crypto';
import {
  clampReviewTimestamp,
  scheduleNextReview,
  type AnalyticsOverviewResponse,
  type BatchReviewSyncResponse,
  type CardDto,
  type CreateCardInput,
  type CreateDeckInput,
  type DeckDto,
  type Locale,
  type PushStatusResponse,
  type PushSubscriptionInput,
  type ReviewEventInput,
  type SrsCardSnapshot,
  type SrsRating,
  type StudyCardWithSrs,
  type StudyQueueResponse,
  type ThemeMode,
  type UpdateCardInput,
  type UpdateDeckInput,
  type UpdateOnboardingInput,
  type UpdatePreferencesInput,
} from '@studypulse/shared';
import type { DataRepository, ListDecksFilter, StoredRefreshToken, StoredUser } from './repository.js';
import { hashPassword } from '../security/password.js';
import {
  computeAnalyticsOverview,
  formatUtcDateKey,
  type RawReviewMetric,
} from '../../features/study/analytics-helper.js';

export const DEMO_USER_EMAIL = 'demo@studypulse.app';
export const DEMO_USER_PASSWORD = 'StudyPulse123!';

interface StoredMemoryReview extends RawReviewMetric {
  id: string;
  userId: string;
  idempotencyKey: string;
  wasTimestampClamped: boolean;
}

export class MemoryRepository implements DataRepository {
  private readonly users = new Map<string, StoredUser>();
  private readonly refreshTokens = new Map<string, StoredRefreshToken>();
  private readonly decks = new Map<string, DeckDto>();
  private readonly cards = new Map<string, CardDto>();
  private readonly srsStates = new Map<string, SrsCardSnapshot>();
  private readonly reviewEvents: StoredMemoryReview[] = [];
  private readonly idempotencyKeys = new Set<string>();
  private readonly pushPrefs = new Map<
    string,
    { pushRemindersEnabled: boolean; pushRoomInvitesEnabled: boolean; reminderHourLocal: number }
  >();
  private readonly pushSubs = new Map<
    string,
    { userId: string; endpoint: string; p256dh: string; auth: string }
  >();

  static async createWithSeed(): Promise<MemoryRepository> {
    const repo = new MemoryRepository();
    await repo.seedDemoData();
    return repo;
  }

  private async seedDemoData(): Promise<void> {
    const passwordHash = await hashPassword(DEMO_USER_PASSWORD);
    const demoUser = await this.createUser({
      email: DEMO_USER_EMAIL,
      passwordHash,
      displayName: 'Ahmed Mostafa',
      locale: 'ar',
      theme: 'system',
    });

    await this.updateUserOnboarding(demoUser.id, {
      interests: ['Frontend', 'System Design', 'PWA'],
      dailyGoal: 20,
    });

    const arDeck = await this.createDeck(
      demoUser.id,
      {
        title: 'أساسيات React و TypeScript للمقابلات',
        description: 'رزمة مبدئية تجمع بين بطاقات الاستدعاء النشط وأسئلة الاختيار من متعدد للغرف الحية.',
        topic: 'Frontend',
        language: 'ar',
        isPublic: true,
      },
      'BUILTIN_TECH_PACK',
    );

    await this.createCardsBulk(arDeck.id, [
      {
        type: 'FLASHCARD',
        front: 'ما الفرق الجوهري بين Server State و Client State في تطبيقات React الحديثة؟',
        back: 'Server State بيانات مصدرها السيرفر وتحتاج Caching وRevalidation (مثل TanStack Query)، بينما Client State حالة واجهة محلية عابرة (مثل Zustand أو useState).',
        explanation: 'فصل نوعي الحالة يمنع تضخم المخزن العام ويبسّط التحديثات المتفائلة (Optimistic Updates).',
        tags: ['React', 'Architecture'],
      },
      {
        type: 'MCQ',
        front: 'أي استراتيجية Workbox يجب استخدامها مع نقاط نهاية المصادقة (`/api/auth`)؟',
        back: 'NetworkOnly لمنع تخزين بيانات الجلسة في كاش المتصفح نهائياً.',
        explanation: 'تخزين ردود المصادقة في Service Worker قد يعرّض الأجهزة المشتركة لتسريب الجلسات.',
        choices: [
          { id: 'c1', text: 'CacheFirst' },
          { id: 'c2', text: 'StaleWhileRevalidate' },
          { id: 'c3', text: 'NetworkOnly' },
          { id: 'c4', text: 'CacheOnly' },
        ],
        correctChoiceId: 'c3',
        tags: ['PWA', 'Security'],
      },
      {
        type: 'MCQ',
        front: 'لماذا نربط `Refresh Token` بمعرّف `family_id` في قاعدة البيانات؟',
        back: 'لاكتشاف إعادة استخدام توكن قديم (Token Reuse) وإبطال عائلة الجلسة بالكامل فوراً.',
        explanation: 'إذا سُرق توكن تحديث وتم تدويره مسبقاً، فإن أي محاولة لإعادة استخدامه تكشف الاختراق وتوقف الجلسة.',
        choices: [
          { id: 'c1', text: 'لتسريع استعلامات CSS' },
          { id: 'c2', text: 'لاكتشاف إعادة استخدام التوكن وإبطال العائلة بالكامل' },
          { id: 'c3', text: 'لتخزين التوكن داخل localStorage' },
          { id: 'c4', text: 'لإلغاء الحاجة إلى HTTPS' },
        ],
        correctChoiceId: 'c2',
        tags: ['Security', 'Auth'],
      },
      {
        type: 'FLASHCARD',
        front: 'لماذا نستخدم `Idempotency Key` في طابور المزامنة الأوفلاين (`sync_outbox`)؟',
        back: 'لضمان عدم تكرار تسجيل نفس المراجعة إذا أُعيد إرسال الطلب بسبب تذبذب الشبكة.',
        explanation: 'يقترن المفتاح بقيد `UNIQUE(user_id, idempotency_key)` في PostgreSQL.',
        tags: ['Offline-First', 'PostgreSQL'],
      },
    ]);

    const enDeck = await this.createDeck(
      demoUser.id,
      {
        title: 'System Design & Realtime WebSockets',
        description: 'Core engineering concepts for building resilient real-time quiz & collaboration apps.',
        topic: 'System Design',
        language: 'en',
        isPublic: true,
      },
      'BUILTIN_TECH_PACK',
    );

    const enCards = await this.createCardsBulk(enDeck.id, [
      {
        type: 'MCQ',
        front: 'How should a live timed quiz prevent client clock tampering?',
        back: 'Use a server-authoritative deadline (`endsAt`) and compute `clockOffset` from `serverTimestamp`.',
        choices: [
          { id: 'c1', text: 'Trust the browser Date.now() directly' },
          { id: 'c2', text: 'Server-authoritative timer + clockOffset sync' },
          { id: 'c3', text: 'Store timer state in localStorage' },
          { id: 'c4', text: 'Disable countdown timers on mobile' },
        ],
        correctChoiceId: 'c2',
        tags: ['WebSockets', 'Security'],
      },
      {
        type: 'FLASHCARD',
        front: 'What is State Reconciliation after a short WebSocket disconnect?',
        back: 'Requesting a full room state snapshot (`room:resync`) on reconnect instead of relying on missed incremental events.',
        tags: ['WebSockets', 'Distributed Systems'],
      },
    ]);

    // Seed realistic historical review activity for the Violet Contribution Heatmap demo
    const arCards = await this.listCardsByDeck(arDeck.id);
    const seedPattern: Array<{ daysAgo: number; count: number; topic: string; cardId: string }> = [
      { daysAgo: 28, count: 4, topic: 'Frontend', cardId: arCards[0]!.id },
      { daysAgo: 25, count: 7, topic: 'System Design', cardId: enCards[0]!.id },
      { daysAgo: 21, count: 10, topic: 'Frontend', cardId: arCards[1]!.id },
      { daysAgo: 18, count: 5, topic: 'System Design', cardId: enCards[1]!.id },
      { daysAgo: 14, count: 12, topic: 'Frontend', cardId: arCards[2]!.id },
      { daysAgo: 10, count: 6, topic: 'System Design', cardId: enCards[0]!.id },
      { daysAgo: 6, count: 9, topic: 'Frontend', cardId: arCards[3]!.id },
      { daysAgo: 4, count: 14, topic: 'System Design', cardId: enCards[1]!.id },
      { daysAgo: 2, count: 8, topic: 'Frontend', cardId: arCards[0]!.id },
      { daysAgo: 1, count: 11, topic: 'Frontend', cardId: arCards[1]!.id },
    ];

    const now = new Date();
    const ratings: SrsRating[] = ['GOOD', 'GOOD', 'EASY', 'HARD', 'GOOD', 'AGAIN'];
    for (const item of seedPattern) {
      for (let i = 0; i < item.count; i += 1) {
        const ts = new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() - item.daysAgo,
            18,
            i * 3,
          ),
        );
        const key = randomUUID();
        this.idempotencyKeys.add(`${demoUser.id}:${key}`);
        this.reviewEvents.push({
          id: randomUUID(),
          userId: demoUser.id,
          cardId: item.cardId,
          idempotencyKey: key,
          topic: item.topic,
          rating: ratings[i % ratings.length]!,
          durationMs: 3200 + (i % 5) * 900,
          effectiveTimestamp: ts,
          wasTimestampClamped: false,
        });
      }
    }
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const normalized = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized) {
        return user;
      }
    }
    return null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    return this.users.get(id) ?? null;
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    locale: Locale;
    theme?: ThemeMode;
  }): Promise<StoredUser> {
    const user: StoredUser = {
      id: randomUUID(),
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      avatarUrl: null,
      streakDays: 3,
      preferences: {
        theme: input.theme ?? 'system',
        locale: input.locale,
        dailyGoal: 20,
        interests: [],
        onboardingCompleted: false,
      },
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUserOnboarding(userId: string, input: UpdateOnboardingInput): Promise<StoredUser> {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    const updated: StoredUser = {
      ...user,
      preferences: {
        ...user.preferences,
        interests: input.interests,
        dailyGoal: input.dailyGoal,
        locale: input.locale ?? user.preferences.locale,
        theme: input.theme ?? user.preferences.theme,
        onboardingCompleted: true,
      },
    };
    this.users.set(userId, updated);
    return updated;
  }

  async createRefreshToken(input: {
    userId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
    ipAddress: string | null;
  }): Promise<StoredRefreshToken> {
    const record: StoredRefreshToken = {
      id: randomUUID(),
      userId: input.userId,
      familyId: input.familyId,
      tokenHash: input.tokenHash,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      expiresAt: input.expiresAt,
      revokedAt: null,
      replacedById: null,
      createdAt: new Date(),
    };
    this.refreshTokens.set(record.id, record);
    return record;
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    for (const token of this.refreshTokens.values()) {
      if (token.tokenHash === tokenHash) return token;
    }
    return null;
  }

  async rotateRefreshToken(input: {
    oldTokenId: string;
    userId: string;
    familyId: string;
    newTokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
    ipAddress: string | null;
  }): Promise<StoredRefreshToken> {
    const next = await this.createRefreshToken({
      userId: input.userId,
      familyId: input.familyId,
      tokenHash: input.newTokenHash,
      expiresAt: input.expiresAt,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });
    const old = this.refreshTokens.get(input.oldTokenId);
    if (old) {
      old.revokedAt = new Date();
      old.replacedById = next.id;
    }
    return next;
  }

  async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    const now = new Date();
    for (const token of this.refreshTokens.values()) {
      if (token.familyId === familyId && !token.revokedAt) {
        token.revokedAt = now;
      }
    }
  }

  private recomputeDeckCounts(deck: DeckDto, userId?: string): DeckDto {
    const nowMs = Date.now();
    let cardCount = 0;
    let dueCount = 0;
    const owner = userId ?? deck.ownerId;
    for (const card of this.cards.values()) {
      if (card.deckId !== deck.id) continue;
      cardCount += 1;
      const srs = this.srsStates.get(`${owner}:${card.id}`);
      if (!srs || new Date(srs.due).getTime() <= nowMs) {
        dueCount += 1;
      }
    }
    return {
      ...deck,
      cardCount,
      dueCount,
    };
  }

  async listDecks(filter: ListDecksFilter): Promise<DeckDto[]> {
    const q = filter.search?.trim().toLowerCase();
    const results: DeckDto[] = [];
    for (const deck of this.decks.values()) {
      if (deck.ownerId !== filter.ownerId) continue;
      if (filter.topic && deck.topic.toLowerCase() !== filter.topic.toLowerCase()) continue;
      if (filter.language && deck.language !== filter.language) continue;
      if (
        q &&
        !deck.title.toLowerCase().includes(q) &&
        !(deck.description ?? '').toLowerCase().includes(q) &&
        !deck.topic.toLowerCase().includes(q)
      ) {
        continue;
      }
      results.push(this.recomputeDeckCounts(deck));
    }
    return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getDeckById(deckId: string, userId: string): Promise<DeckDto | null> {
    const deck = this.decks.get(deckId);
    if (!deck) return null;
    if (deck.ownerId !== userId && !deck.isPublic) return null;
    return this.recomputeDeckCounts(deck);
  }

  async createDeck(
    ownerId: string,
    input: CreateDeckInput,
    _sourceKind?: string,
  ): Promise<DeckDto> {
    const now = new Date().toISOString();
    const deck: DeckDto = {
      id: randomUUID(),
      ownerId,
      title: input.title,
      description: input.description ?? null,
      topic: input.topic,
      language: input.language,
      isPublic: input.isPublic,
      cardCount: 0,
      dueCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.decks.set(deck.id, deck);
    return deck;
  }

  async updateDeck(
    deckId: string,
    ownerId: string,
    input: UpdateDeckInput,
  ): Promise<DeckDto | null> {
    const existing = this.decks.get(deckId);
    if (!existing || existing.ownerId !== ownerId) return null;
    const updated: DeckDto = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.topic !== undefined ? { topic: input.topic } : {}),
      ...(input.language !== undefined ? { language: input.language } : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.decks.set(deckId, updated);
    return this.recomputeDeckCounts(updated);
  }

  async deleteDeck(deckId: string, ownerId: string): Promise<boolean> {
    const existing = this.decks.get(deckId);
    if (!existing || existing.ownerId !== ownerId) return false;
    this.decks.delete(deckId);
    for (const [cardId, card] of this.cards.entries()) {
      if (card.deckId === deckId) this.cards.delete(cardId);
    }
    return true;
  }

  async listCardsByDeck(deckId: string): Promise<CardDto[]> {
    const list: CardDto[] = [];
    for (const card of this.cards.values()) {
      if (card.deckId === deckId) list.push(card);
    }
    return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async createCardsBulk(deckId: string, inputs: CreateCardInput[]): Promise<CardDto[]> {
    const created: CardDto[] = [];
    const baseMs = Date.now();
    for (let i = 0; i < inputs.length; i += 1) {
      const input = inputs[i];
      if (!input) continue;
      const ts = new Date(baseMs + i).toISOString();
      const card: CardDto = {
        id: randomUUID(),
        deckId,
        type: input.type,
        front: input.front,
        back: input.back,
        explanation: input.explanation ?? null,
        choices: input.type === 'MCQ' ? (input.choices ?? null) : null,
        correctChoiceId: input.type === 'MCQ' ? (input.correctChoiceId ?? null) : null,
        tags: input.tags ?? [],
        createdAt: ts,
        updatedAt: ts,
      };
      this.cards.set(card.id, card);
      created.push(card);
    }
    const deck = this.decks.get(deckId);
    if (deck) {
      deck.updatedAt = new Date().toISOString();
    }
    return created;
  }

  async updateCard(
    deckId: string,
    cardId: string,
    input: UpdateCardInput,
  ): Promise<CardDto | null> {
    const existing = this.cards.get(cardId);
    if (!existing || existing.deckId !== deckId) return null;
    const nextType = input.type ?? existing.type;
    const updated: CardDto = {
      ...existing,
      type: nextType,
      front: input.front ?? existing.front,
      back: input.back ?? existing.back,
      explanation: input.explanation !== undefined ? input.explanation : existing.explanation,
      choices: nextType === 'MCQ' ? (input.choices ?? existing.choices ?? null) : null,
      correctChoiceId:
        nextType === 'MCQ' ? (input.correctChoiceId ?? existing.correctChoiceId ?? null) : null,
      tags: input.tags ?? existing.tags,
      updatedAt: new Date().toISOString(),
    };
    this.cards.set(cardId, updated);
    return updated;
  }

  async deleteCard(deckId: string, cardId: string): Promise<boolean> {
    const existing = this.cards.get(cardId);
    if (!existing || existing.deckId !== deckId) return false;
    this.cards.delete(cardId);
    return true;
  }

  async getStudyQueue(
    userId: string,
    options?: { deckId?: string; limit?: number },
  ): Promise<StudyQueueResponse> {
    const now = new Date();
    const nowMs = now.getTime();
    const todayKey = formatUtcDateKey(now);
    const limit = options?.limit ?? 30;
    const user = this.users.get(userId);

    const eligible: StudyCardWithSrs[] = [];
    for (const card of this.cards.values()) {
      const deck = this.decks.get(card.deckId);
      if (!deck) continue;
      if (deck.ownerId !== userId && !deck.isPublic) continue;
      if (options?.deckId && deck.id !== options.deckId) continue;

      const srs = this.srsStates.get(`${userId}:${card.id}`) ?? null;
      if (!srs || new Date(srs.due).getTime() <= nowMs) {
        eligible.push({ card, deckTitle: deck.title, srs });
      }
    }

    eligible.sort((a, b) => {
      const aDue = a.srs ? new Date(a.srs.due).getTime() : 0;
      const bDue = b.srs ? new Date(b.srs.due).getTime() : 0;
      return aDue - bDue;
    });

    const reviewedToday = this.reviewEvents.filter(
      (ev) => ev.userId === userId && formatUtcDateKey(ev.effectiveTimestamp) === todayKey,
    ).length;

    return {
      items: eligible.slice(0, limit),
      dueTotal: eligible.length,
      reviewedToday,
      dailyGoal: user?.preferences.dailyGoal ?? 20,
    };
  }

  async recordReviewBatch(
    userId: string,
    events: ReviewEventInput[],
  ): Promise<BatchReviewSyncResponse> {
    const serverNow = new Date();
    let acceptedCount = 0;
    let deduplicatedCount = 0;
    let clampedCount = 0;
    const updatedMap = new Map<string, SrsCardSnapshot>();

    // Sort chronologically so sequential offline reviews replay accurately
    const ordered = [...events].sort((a, b) => a.clientTimestamp.localeCompare(b.clientTimestamp));

    for (const ev of ordered) {
      const idemKey = `${userId}:${ev.idempotencyKey}`;
      if (this.idempotencyKeys.has(idemKey)) {
        deduplicatedCount += 1;
        continue;
      }

      const card = this.cards.get(ev.cardId);
      const deck = card ? this.decks.get(card.deckId) : undefined;
      if (!card || !deck) continue;

      const { effectiveTimestamp, wasClamped } = clampReviewTimestamp(
        new Date(ev.clientTimestamp),
        serverNow,
      );
      if (wasClamped) clampedCount += 1;

      const srsKey = `${userId}:${card.id}`;
      const current = this.srsStates.get(srsKey) ?? null;
      const nextSrs = scheduleNextReview(current, ev.rating, effectiveTimestamp);

      this.srsStates.set(srsKey, nextSrs);
      this.idempotencyKeys.add(idemKey);
      this.reviewEvents.push({
        id: randomUUID(),
        userId,
        cardId: card.id,
        idempotencyKey: ev.idempotencyKey,
        topic: deck.topic,
        rating: ev.rating,
        durationMs: ev.durationMs,
        effectiveTimestamp,
        wasTimestampClamped: wasClamped,
      });

      updatedMap.set(card.id, nextSrs);
      acceptedCount += 1;
    }

    const user = this.users.get(userId);
    if (user && acceptedCount > 0) {
      user.streakDays = Math.max(1, user.streakDays);
    }

    return {
      acceptedCount,
      deduplicatedCount,
      clampedCount,
      streakDays: user?.streakDays ?? 1,
      updatedStates: Array.from(updatedMap.entries()).map(([cardId, srs]) => ({
        cardId,
        srs,
      })),
    };
  }

  async getAnalyticsOverview(userId: string): Promise<AnalyticsOverviewResponse> {
    const user = this.users.get(userId);
    const nowMs = Date.now();
    const dueByTopic = new Map<string, number>();

    for (const card of this.cards.values()) {
      const deck = this.decks.get(card.deckId);
      if (!deck || deck.ownerId !== userId) continue;
      const srs = this.srsStates.get(`${userId}:${card.id}`);
      if (!srs || new Date(srs.due).getTime() <= nowMs) {
        dueByTopic.set(deck.topic, (dueByTopic.get(deck.topic) ?? 0) + 1);
      }
    }

    const userReviews = this.reviewEvents.filter((ev) => ev.userId === userId);
    return computeAnalyticsOverview({
      reviews: userReviews,
      dueByTopic,
      streakDays: user?.streakDays ?? 0,
      dailyGoal: user?.preferences.dailyGoal ?? 20,
    });
  }

  async updateUserPreferences(
    userId: string,
    input: UpdatePreferencesInput,
  ): Promise<StoredUser> {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');

    const updated: StoredUser = {
      ...user,
      preferences: {
        ...user.preferences,
        ...(input.theme ? { theme: input.theme } : {}),
        ...(input.locale ? { locale: input.locale } : {}),
        ...(input.dailyGoal ? { dailyGoal: input.dailyGoal } : {}),
      },
    };
    this.users.set(userId, updated);

    const existingPush = this.pushPrefs.get(userId) ?? {
      pushRemindersEnabled: false,
      pushRoomInvitesEnabled: true,
      reminderHourLocal: 20,
    };
    this.pushPrefs.set(userId, {
      pushRemindersEnabled: input.pushRemindersEnabled ?? existingPush.pushRemindersEnabled,
      pushRoomInvitesEnabled: input.pushRoomInvitesEnabled ?? existingPush.pushRoomInvitesEnabled,
      reminderHourLocal: input.reminderHourLocal ?? existingPush.reminderHourLocal,
    });

    return updated;
  }

  async getPushStatus(
    userId: string,
    vapidPublicKey: string | null,
  ): Promise<PushStatusResponse> {
    let subscriptionCount = 0;
    for (const sub of this.pushSubs.values()) {
      if (sub.userId === userId) subscriptionCount += 1;
    }
    const prefs = this.pushPrefs.get(userId) ?? {
      pushRemindersEnabled: false,
      pushRoomInvitesEnabled: true,
      reminderHourLocal: 20,
    };
    return {
      subscribed: subscriptionCount > 0,
      subscriptionCount,
      vapidPublicKey,
      ...prefs,
    };
  }

  async savePushSubscription(
    userId: string,
    sub: PushSubscriptionInput,
    _userAgent: string | null,
  ): Promise<void> {
    this.pushSubs.set(sub.endpoint, {
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    });
    const existing = this.pushPrefs.get(userId) ?? {
      pushRemindersEnabled: true,
      pushRoomInvitesEnabled: true,
      reminderHourLocal: 20,
    };
    this.pushPrefs.set(userId, { ...existing, pushRemindersEnabled: true });
  }

  async deletePushSubscription(userId: string, endpoint: string): Promise<void> {
    const existing = this.pushSubs.get(endpoint);
    if (existing && existing.userId === userId) {
      this.pushSubs.delete(endpoint);
    }
  }
}
