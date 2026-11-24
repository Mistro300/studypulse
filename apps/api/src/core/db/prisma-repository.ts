import type { PrismaClient } from '@prisma/client';
import {
  clampReviewTimestamp,
  scheduleNextReview,
  type AnalyticsOverviewResponse,
  type BatchReviewSyncResponse,
  type CardChoice,
  type CardDto,
  type CreateCardInput,
  type CreateDeckInput,
  type DeckDto,
  type Locale,
  type PushStatusResponse,
  type PushSubscriptionInput,
  type ReviewEventInput,
  type SrsCardSnapshot,
  type StudyCardWithSrs,
  type StudyQueueResponse,
  type ThemeMode,
  type UpdateCardInput,
  type UpdateDeckInput,
  type UpdateOnboardingInput,
  type UpdatePreferencesInput,
} from '@studypulse/shared';
import type { DataRepository, ListDecksFilter, StoredRefreshToken, StoredUser } from './repository.js';
import { computeAnalyticsOverview } from '../../features/study/analytics-helper.js';

export class PrismaRepository implements DataRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapUser(
    user: {
      id: string;
      email: string;
      passwordHash: string | null;
      displayName: string;
      avatarUrl: string | null;
      streakDays: number;
      preferences: {
        theme: ThemeMode;
        locale: Locale;
        dailyGoal: number;
        interestsJson: unknown;
      } | null;
    },
  ): StoredUser {
    const rawInterests = user.preferences?.interestsJson;
    const interests = Array.isArray(rawInterests)
      ? rawInterests.filter((v): v is string => typeof v === 'string')
      : [];

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      streakDays: user.streakDays,
      preferences: {
        theme: user.preferences?.theme ?? 'system',
        locale: user.preferences?.locale ?? 'ar',
        dailyGoal: user.preferences?.dailyGoal ?? 20,
        interests,
        onboardingCompleted: interests.length > 0,
      },
    };
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { preferences: true },
    });
    return user ? this.mapUser(user) : null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { preferences: true },
    });
    return user ? this.mapUser(user) : null;
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    locale: Locale;
    theme?: ThemeMode;
  }): Promise<StoredUser> {
    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        preferences: {
          create: {
            locale: input.locale,
            theme: input.theme ?? 'system',
          },
        },
      },
      include: { preferences: true },
    });
    return this.mapUser(user);
  }

  async updateUserOnboarding(userId: string, input: UpdateOnboardingInput): Promise<StoredUser> {
    await this.prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        interestsJson: input.interests,
        dailyGoal: input.dailyGoal,
        locale: input.locale ?? 'ar',
        theme: input.theme ?? 'system',
      },
      update: {
        interestsJson: input.interests,
        dailyGoal: input.dailyGoal,
        ...(input.locale ? { locale: input.locale } : {}),
        ...(input.theme ? { theme: input.theme } : {}),
      },
    });
    const updated = await this.findUserById(userId);
    if (!updated) throw new Error('User not found after onboarding update');
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
    return this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        familyId: input.familyId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
      },
    });
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
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
    return this.prisma.$transaction(async (tx) => {
      const next = await tx.refreshToken.create({
        data: {
          userId: input.userId,
          familyId: input.familyId,
          tokenHash: input.newTokenHash,
          expiresAt: input.expiresAt,
          userAgent: input.userAgent,
          ipAddress: input.ipAddress,
        },
      });
      await tx.refreshToken.update({
        where: { id: input.oldTokenId },
        data: { revokedAt: new Date(), replacedById: next.id },
      });
      return next;
    });
  }

  async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async listDecks(filter: ListDecksFilter): Promise<DeckDto[]> {
    const rows = await this.prisma.deck.findMany({
      where: {
        ownerId: filter.ownerId,
        ...(filter.topic ? { topic: { equals: filter.topic, mode: 'insensitive' } } : {}),
        ...(filter.language ? { language: filter.language } : {}),
        ...(filter.search
          ? {
              OR: [
                { title: { contains: filter.search, mode: 'insensitive' } },
                { description: { contains: filter.search, mode: 'insensitive' } },
                { topic: { contains: filter.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { cards: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((d) => ({
      id: d.id,
      ownerId: d.ownerId,
      title: d.title,
      description: d.description,
      topic: d.topic,
      language: d.language,
      isPublic: d.isPublic,
      cardCount: d._count.cards,
      dueCount: d._count.cards,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  async getDeckById(deckId: string, userId: string): Promise<DeckDto | null> {
    const d = await this.prisma.deck.findFirst({
      where: { id: deckId, OR: [{ ownerId: userId }, { isPublic: true }] },
      include: { _count: { select: { cards: true } } },
    });
    if (!d) return null;
    return {
      id: d.id,
      ownerId: d.ownerId,
      title: d.title,
      description: d.description,
      topic: d.topic,
      language: d.language,
      isPublic: d.isPublic,
      cardCount: d._count.cards,
      dueCount: d._count.cards,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  async createDeck(
    ownerId: string,
    input: CreateDeckInput,
    sourceKind?: string,
  ): Promise<DeckDto> {
    const d = await this.prisma.deck.create({
      data: {
        ownerId,
        title: input.title,
        description: input.description ?? null,
        topic: input.topic,
        language: input.language,
        isPublic: input.isPublic,
        sourceKind: sourceKind ?? null,
      },
    });
    return {
      id: d.id,
      ownerId: d.ownerId,
      title: d.title,
      description: d.description,
      topic: d.topic,
      language: d.language,
      isPublic: d.isPublic,
      cardCount: 0,
      dueCount: 0,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  async updateDeck(
    deckId: string,
    ownerId: string,
    input: UpdateDeckInput,
  ): Promise<DeckDto | null> {
    const existing = await this.prisma.deck.findFirst({ where: { id: deckId, ownerId } });
    if (!existing) return null;
    const d = await this.prisma.deck.update({
      where: { id: deckId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.topic !== undefined ? { topic: input.topic } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
        ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
      },
      include: { _count: { select: { cards: true } } },
    });
    return {
      id: d.id,
      ownerId: d.ownerId,
      title: d.title,
      description: d.description,
      topic: d.topic,
      language: d.language,
      isPublic: d.isPublic,
      cardCount: d._count.cards,
      dueCount: d._count.cards,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  async deleteDeck(deckId: string, ownerId: string): Promise<boolean> {
    const res = await this.prisma.deck.deleteMany({ where: { id: deckId, ownerId } });
    return res.count > 0;
  }

  private mapCard(c: {
    id: string;
    deckId: string;
    type: 'FLASHCARD' | 'MCQ';
    front: string;
    back: string;
    explanation: string | null;
    choicesJson: unknown;
    correctChoiceId: string | null;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
  }): CardDto {
    return {
      id: c.id,
      deckId: c.deckId,
      type: c.type,
      front: c.front,
      back: c.back,
      explanation: c.explanation,
      choices: Array.isArray(c.choicesJson) ? (c.choicesJson as CardChoice[]) : null,
      correctChoiceId: c.correctChoiceId,
      tags: c.tags,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  async listCardsByDeck(deckId: string): Promise<CardDto[]> {
    const rows = await this.prisma.card.findMany({
      where: { deckId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((c) => this.mapCard(c));
  }

  async createCardsBulk(deckId: string, inputs: CreateCardInput[]): Promise<CardDto[]> {
    const created = await this.prisma.$transaction(
      inputs.map((input) =>
        this.prisma.card.create({
          data: {
            deckId,
            type: input.type,
            front: input.front,
            back: input.back,
            explanation: input.explanation ?? null,
            choicesJson: input.type === 'MCQ' && input.choices ? input.choices : undefined,
            correctChoiceId: input.type === 'MCQ' ? (input.correctChoiceId ?? null) : null,
            tags: input.tags ?? [],
          },
        }),
      ),
    );
    return created.map((c) => this.mapCard(c));
  }

  async updateCard(
    deckId: string,
    cardId: string,
    input: UpdateCardInput,
  ): Promise<CardDto | null> {
    const existing = await this.prisma.card.findFirst({ where: { id: cardId, deckId } });
    if (!existing) return null;
    const nextType = input.type ?? existing.type;
    const c = await this.prisma.card.update({
      where: { id: cardId },
      data: {
        type: nextType,
        ...(input.front !== undefined ? { front: input.front } : {}),
        ...(input.back !== undefined ? { back: input.back } : {}),
        ...(input.explanation !== undefined ? { explanation: input.explanation } : {}),
        ...(nextType === 'MCQ'
          ? {
              ...(input.choices !== undefined ? { choicesJson: input.choices ?? undefined } : {}),
              ...(input.correctChoiceId !== undefined
                ? { correctChoiceId: input.correctChoiceId }
                : {}),
            }
          : { choicesJson: undefined, correctChoiceId: null }),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
      },
    });
    return this.mapCard(c);
  }

  async deleteCard(deckId: string, cardId: string): Promise<boolean> {
    const res = await this.prisma.card.deleteMany({ where: { id: cardId, deckId } });
    return res.count > 0;
  }

  async getStudyQueue(
    userId: string,
    options?: { deckId?: string; limit?: number },
  ): Promise<StudyQueueResponse> {
    const now = new Date();
    const limit = options?.limit ?? 30;
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    const [user, cards, reviewedToday] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, include: { preferences: true } }),
      this.prisma.card.findMany({
        where: {
          deck: {
            OR: [{ ownerId: userId }, { isPublic: true }],
            ...(options?.deckId ? { id: options.deckId } : {}),
          },
        },
        include: {
          deck: { select: { title: true } },
          srsStates: { where: { userId }, take: 1 },
        },
      }),
      this.prisma.reviewEvent.count({
        where: { userId, effectiveTimestamp: { gte: startOfToday } },
      }),
    ]);

    const dueItems: StudyCardWithSrs[] = [];
    for (const c of cards) {
      const stateRow = c.srsStates[0];
      const srs: SrsCardSnapshot | null = stateRow
        ? {
            due: stateRow.due.toISOString(),
            stability: stateRow.stability,
            difficulty: stateRow.difficulty,
            elapsedDays: stateRow.elapsedDays,
            scheduledDays: stateRow.scheduledDays,
            reps: stateRow.reps,
            lapses: stateRow.lapses,
            state: stateRow.state,
            lastReview: stateRow.lastReview ? stateRow.lastReview.toISOString() : null,
          }
        : null;

      if (!srs || new Date(srs.due).getTime() <= now.getTime()) {
        dueItems.push({ card: this.mapCard(c), deckTitle: c.deck.title, srs });
      }
    }

    dueItems.sort((a, b) => {
      const aDue = a.srs ? new Date(a.srs.due).getTime() : 0;
      const bDue = b.srs ? new Date(b.srs.due).getTime() : 0;
      return aDue - bDue;
    });

    return {
      items: dueItems.slice(0, limit),
      dueTotal: dueItems.length,
      reviewedToday,
      dailyGoal: user?.preferences?.dailyGoal ?? 20,
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

    const ordered = [...events].sort((a, b) => a.clientTimestamp.localeCompare(b.clientTimestamp));

    for (const ev of ordered) {
      const existing = await this.prisma.reviewEvent.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: ev.idempotencyKey } },
      });
      if (existing) {
        deduplicatedCount += 1;
        continue;
      }

      const { effectiveTimestamp, wasClamped } = clampReviewTimestamp(
        new Date(ev.clientTimestamp),
        serverNow,
      );
      if (wasClamped) clampedCount += 1;

      const currentRow = await this.prisma.cardSrsState.findUnique({
        where: { userId_cardId: { userId, cardId: ev.cardId } },
      });

      const currentSnapshot: SrsCardSnapshot | null = currentRow
        ? {
            due: currentRow.due.toISOString(),
            stability: currentRow.stability,
            difficulty: currentRow.difficulty,
            elapsedDays: currentRow.elapsedDays,
            scheduledDays: currentRow.scheduledDays,
            reps: currentRow.reps,
            lapses: currentRow.lapses,
            state: currentRow.state,
            lastReview: currentRow.lastReview ? currentRow.lastReview.toISOString() : null,
          }
        : null;

      const nextSrs = scheduleNextReview(currentSnapshot, ev.rating, effectiveTimestamp);

      await this.prisma.$transaction([
        this.prisma.reviewEvent.create({
          data: {
            userId,
            cardId: ev.cardId,
            idempotencyKey: ev.idempotencyKey,
            rating: ev.rating,
            durationMs: ev.durationMs,
            clientTimestamp: new Date(ev.clientTimestamp),
            effectiveTimestamp,
            wasTimestampClamped: wasClamped,
          },
        }),
        this.prisma.cardSrsState.upsert({
          where: { userId_cardId: { userId, cardId: ev.cardId } },
          create: {
            userId,
            cardId: ev.cardId,
            due: new Date(nextSrs.due),
            stability: nextSrs.stability,
            difficulty: nextSrs.difficulty,
            elapsedDays: nextSrs.elapsedDays,
            scheduledDays: nextSrs.scheduledDays,
            reps: nextSrs.reps,
            lapses: nextSrs.lapses,
            state: nextSrs.state,
            lastReview: nextSrs.lastReview ? new Date(nextSrs.lastReview) : null,
          },
          update: {
            due: new Date(nextSrs.due),
            stability: nextSrs.stability,
            difficulty: nextSrs.difficulty,
            elapsedDays: nextSrs.elapsedDays,
            scheduledDays: nextSrs.scheduledDays,
            reps: nextSrs.reps,
            lapses: nextSrs.lapses,
            state: nextSrs.state,
            lastReview: nextSrs.lastReview ? new Date(nextSrs.lastReview) : null,
          },
        }),
      ]);

      updatedMap.set(ev.cardId, nextSrs);
      acceptedCount += 1;
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    let streakDays = user?.streakDays ?? 0;
    if (acceptedCount > 0) {
      streakDays = Math.max(1, streakDays);
      await this.prisma.user.update({
        where: { id: userId },
        data: { streakDays, lastStudyDate: serverNow },
      });
    }

    return {
      acceptedCount,
      deduplicatedCount,
      clampedCount,
      streakDays,
      updatedStates: Array.from(updatedMap.entries()).map(([cardId, srs]) => ({
        cardId,
        srs,
      })),
    };
  }

  async getAnalyticsOverview(userId: string): Promise<AnalyticsOverviewResponse> {
    const now = new Date();
    const ninetyOneDaysAgo = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 91),
    );

    const [user, events, cards] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, include: { preferences: true } }),
      this.prisma.reviewEvent.findMany({
        where: { userId, effectiveTimestamp: { gte: ninetyOneDaysAgo } },
        include: { card: { include: { deck: { select: { topic: true } } } } },
      }),
      this.prisma.card.findMany({
        where: { deck: { ownerId: userId } },
        include: {
          deck: { select: { topic: true } },
          srsStates: { where: { userId }, take: 1 },
        },
      }),
    ]);

    const dueByTopic = new Map<string, number>();
    for (const c of cards) {
      const srs = c.srsStates[0];
      if (!srs || srs.due.getTime() <= now.getTime()) {
        dueByTopic.set(c.deck.topic, (dueByTopic.get(c.deck.topic) ?? 0) + 1);
      }
    }

    return computeAnalyticsOverview({
      reviews: events.map((e) => ({
        cardId: e.cardId,
        topic: e.card.deck.topic,
        rating: e.rating,
        durationMs: e.durationMs,
        effectiveTimestamp: e.effectiveTimestamp,
      })),
      dueByTopic,
      streakDays: user?.streakDays ?? 0,
      dailyGoal: user?.preferences?.dailyGoal ?? 20,
      now,
    });
  }

  async updateUserPreferences(
    userId: string,
    input: UpdatePreferencesInput,
  ): Promise<StoredUser> {
    await this.prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        theme: input.theme ?? 'system',
        locale: input.locale ?? 'ar',
        dailyGoal: input.dailyGoal ?? 20,
        pushRemindersEnabled: input.pushRemindersEnabled ?? false,
        pushRoomInvitesEnabled: input.pushRoomInvitesEnabled ?? true,
        reminderHourLocal: input.reminderHourLocal ?? 20,
      },
      update: {
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
        ...(input.locale !== undefined ? { locale: input.locale } : {}),
        ...(input.dailyGoal !== undefined ? { dailyGoal: input.dailyGoal } : {}),
        ...(input.pushRemindersEnabled !== undefined
          ? { pushRemindersEnabled: input.pushRemindersEnabled }
          : {}),
        ...(input.pushRoomInvitesEnabled !== undefined
          ? { pushRoomInvitesEnabled: input.pushRoomInvitesEnabled }
          : {}),
        ...(input.reminderHourLocal !== undefined
          ? { reminderHourLocal: input.reminderHourLocal }
          : {}),
      },
    });
    const updated = await this.findUserById(userId);
    if (!updated) throw new Error('User not found after preferences update');
    return updated;
  }

  async getPushStatus(
    userId: string,
    vapidPublicKey: string | null,
  ): Promise<PushStatusResponse> {
    const [subscriptionCount, pref] = await Promise.all([
      this.prisma.pushSubscription.count({ where: { userId } }),
      this.prisma.userPreference.findUnique({ where: { userId } }),
    ]);
    return {
      subscribed: subscriptionCount > 0,
      subscriptionCount,
      vapidPublicKey,
      pushRemindersEnabled: pref?.pushRemindersEnabled ?? false,
      pushRoomInvitesEnabled: pref?.pushRoomInvitesEnabled ?? true,
      reminderHourLocal: pref?.reminderHourLocal ?? 20,
    };
  }

  async savePushSubscription(
    userId: string,
    sub: PushSubscriptionInput,
    userAgent: string | null,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.pushSubscription.upsert({
        where: { endpoint: sub.endpoint },
        create: {
          userId,
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          userAgent,
        },
        update: {
          userId,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          userAgent,
        },
      }),
      this.prisma.userPreference.upsert({
        where: { userId },
        create: { userId, pushRemindersEnabled: true },
        update: { pushRemindersEnabled: true },
      }),
    ]);
  }

  async deletePushSubscription(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }
}
