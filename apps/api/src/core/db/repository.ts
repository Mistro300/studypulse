import type {
  AnalyticsOverviewResponse,
  BatchReviewSyncResponse,
  CardDto,
  CreateCardInput,
  CreateDeckInput,
  DeckDto,
  Locale,
  PushStatusResponse,
  PushSubscriptionInput,
  ReviewEventInput,
  StudyQueueResponse,
  ThemeMode,
  UpdateCardInput,
  UpdateDeckInput,
  UpdateOnboardingInput,
  UpdatePreferencesInput,
  UserProfile,
} from '@studypulse/shared';

export interface StoredUser extends UserProfile {
  passwordHash: string | null;
}

export interface StoredRefreshToken {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  createdAt: Date;
}

export interface ListDecksFilter {
  ownerId: string;
  search?: string;
  topic?: string;
  language?: Locale;
}

export interface DataRepository {
  // Users
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  createUser(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    locale: Locale;
    theme?: ThemeMode;
  }): Promise<StoredUser>;
  updateUserOnboarding(userId: string, input: UpdateOnboardingInput): Promise<StoredUser>;

  // Refresh tokens (with family rotation & reuse detection)
  createRefreshToken(input: {
    userId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
    ipAddress: string | null;
  }): Promise<StoredRefreshToken>;
  findRefreshTokenByHash(tokenHash: string): Promise<StoredRefreshToken | null>;
  rotateRefreshToken(input: {
    oldTokenId: string;
    userId: string;
    familyId: string;
    newTokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
    ipAddress: string | null;
  }): Promise<StoredRefreshToken>;
  revokeRefreshTokenFamily(familyId: string): Promise<void>;

  // Decks & Cards
  listDecks(filter: ListDecksFilter): Promise<DeckDto[]>;
  getDeckById(deckId: string, userId: string): Promise<DeckDto | null>;
  createDeck(ownerId: string, input: CreateDeckInput, sourceKind?: string): Promise<DeckDto>;
  updateDeck(deckId: string, ownerId: string, input: UpdateDeckInput): Promise<DeckDto | null>;
  deleteDeck(deckId: string, ownerId: string): Promise<boolean>;

  listCardsByDeck(deckId: string): Promise<CardDto[]>;
  createCardsBulk(deckId: string, cards: CreateCardInput[]): Promise<CardDto[]>;
  updateCard(
    deckId: string,
    cardId: string,
    input: UpdateCardInput,
  ): Promise<CardDto | null>;
  deleteCard(deckId: string, cardId: string): Promise<boolean>;

  // Study Session & Analytics (FSRS-5)
  getStudyQueue(
    userId: string,
    options?: { deckId?: string; limit?: number },
  ): Promise<StudyQueueResponse>;
  recordReviewBatch(
    userId: string,
    events: ReviewEventInput[],
  ): Promise<BatchReviewSyncResponse>;
  getAnalyticsOverview(userId: string): Promise<AnalyticsOverviewResponse>;

  // User Preferences & Web Push Subscriptions
  updateUserPreferences(userId: string, input: UpdatePreferencesInput): Promise<StoredUser>;
  getPushStatus(userId: string, vapidPublicKey: string | null): Promise<PushStatusResponse>;
  savePushSubscription(
    userId: string,
    sub: PushSubscriptionInput,
    userAgent: string | null,
  ): Promise<void>;
  deletePushSubscription(userId: string, endpoint: string): Promise<void>;
}
