import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type {
  AnalyticsOverviewResponse,
  BatchReviewSyncResponse,
  CardDto,
  StudyQueueResponse,
} from '@studypulse/shared';
import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { REFRESH_COOKIE_NAME } from './features/auth/auth.routes.js';
import { buildAutoDistractorMcq } from './features/questions/adapters.js';

function extractRefreshCookie(setCookieHeader: string | string[] | undefined): string {
  const list = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const match = list
    .map((c) => c.split(';')[0] ?? '')
    .find((pair) => pair.startsWith(`${REFRESH_COOKIE_NAME}=`));
  assert.ok(match, 'Expected sp_refresh HttpOnly cookie to be set');
  return match;
}

describe('Phase 1 API — Auth Family Rotation, Decks/Cards CRUD & QuestionSourceAdapter', () => {
  const env = loadEnv({ NODE_ENV: 'test', API_STORAGE: 'memory' });

  it('registers, rotates refresh tokens, and revokes entire family on token reuse', async () => {
    const { fastify } = await buildApp(env);

    // 1. Register
    const reg = await fastify.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'architect@studypulse.app',
        password: 'StrongPassword123!',
        displayName: 'Senior Architect',
        locale: 'ar',
      },
    });
    assert.equal(reg.statusCode, 201);
    const cookie1 = extractRefreshCookie(reg.headers['set-cookie']);

    // 2. Rotate refresh token (cookie1 -> cookie2)
    const ref1 = await fastify.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: cookie1 },
    });
    assert.equal(ref1.statusCode, 200);
    const cookie2 = extractRefreshCookie(ref1.headers['set-cookie']);
    assert.notEqual(cookie1, cookie2);

    // 3. Replay old cookie1 -> triggers family reuse detection -> 401
    const replay = await fastify.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: cookie1 },
    });
    assert.equal(replay.statusCode, 401);

    // 4. Even the newer cookie2 from the same compromised family is now revoked -> 401!
    const compromised = await fastify.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: cookie2 },
    });
    assert.equal(compromised.statusCode, 401);

    await fastify.close();
  });

  it('supports Decks & Cards CRUD (FLASHCARD + MCQ), Built-in Import, Notes Generation, and Auto-Distractor', async () => {
    const { fastify } = await buildApp(env);

    // 1-click Demo Login
    const demo = await fastify.inject({ method: 'POST', url: '/api/auth/demo' });
    assert.equal(demo.statusCode, 200);
    const { accessToken } = demo.json() as { accessToken: string };
    const authHeaders = { authorization: `Bearer ${accessToken}` };

    // Create Deck
    const createDeck = await fastify.inject({
      method: 'POST',
      url: '/api/decks',
      headers: authHeaders,
      payload: {
        title: 'TypeScript Mastery',
        description: 'Strict TS patterns',
        topic: 'Frontend',
        language: 'en',
        isPublic: false,
      },
    });
    assert.equal(createDeck.statusCode, 201);
    const deckId = (createDeck.json() as { deck: { id: string } }).deck.id;

    // Create FLASHCARD
    const fc = await fastify.inject({
      method: 'POST',
      url: `/api/decks/${deckId}/cards`,
      headers: authHeaders,
      payload: {
        type: 'FLASHCARD',
        front: 'What is a discriminated union?',
        back: 'A union of object types sharing a common literal discriminant property.',
        tags: ['TypeScript'],
      },
    });
    assert.equal(fc.statusCode, 201);

    // Invalid MCQ without choices -> 400 VALIDATION_ERROR
    const invalidMcq = await fastify.inject({
      method: 'POST',
      url: `/api/decks/${deckId}/cards`,
      headers: authHeaders,
      payload: {
        type: 'MCQ',
        front: 'Invalid MCQ',
        back: 'Missing choices',
      },
    });
    assert.equal(invalidMcq.statusCode, 400);

    // Import from Built-in Bilingual Tech Pack
    const imported = await fastify.inject({
      method: 'POST',
      url: `/api/decks/${deckId}/import`,
      headers: authHeaders,
      payload: { source: 'BUILTIN_TECH_PACK', packId: 'react-ts-ar', amount: 4 },
    });
    assert.equal(imported.statusCode, 201);
    assert.equal((imported.json() as { importedCount: number }).importedCount, 4);

    // Generate cards from raw study notes (Mock LLM fallback when no key)
    const generated = await fastify.inject({
      method: 'POST',
      url: `/api/decks/${deckId}/generate-from-notes`,
      headers: authHeaders,
      payload: {
        notes:
          'FSRS-5: Modern spaced repetition algorithm. Service Worker: Intercepts network requests for offline PWA support. IndexedDB: Stores structured offline cards.',
        maxCards: 3,
        cardType: 'FLASHCARD',
        language: 'en',
      },
    });
    assert.equal(generated.statusCode, 201);
    assert.ok((generated.json() as { importedCount: number }).importedCount >= 2);

    // Fetch deck detail & verify Auto-Distractor converts any FLASHCARD into 4-choice MCQ
    const detail = await fastify.inject({
      method: 'GET',
      url: `/api/decks/${deckId}`,
      headers: authHeaders,
    });
    assert.equal(detail.statusCode, 200);
    const { cards } = detail.json() as { cards: CardDto[] };
    assert.ok(cards.length >= 6);

    const flashcard = cards.find((c) => c.type === 'FLASHCARD');
    assert.ok(flashcard);
    const mcq = buildAutoDistractorMcq(flashcard, cards);
    assert.equal(mcq.choices.length, 4);
    assert.ok(mcq.choices.some((c) => c.id === mcq.correctChoiceId));

    await fastify.close();
  });

  it('runs FSRS-5 study queue, idempotent review batch sync with timestamp clamping, and analytics heatmap', async () => {
    const { fastify } = await buildApp(env);
    const demo = await fastify.inject({ method: 'POST', url: '/api/auth/demo' });
    const { accessToken } = demo.json() as { accessToken: string };
    const authHeaders = { authorization: `Bearer ${accessToken}` };

    // 1. Fetch due queue
    const queueRes = await fastify.inject({
      method: 'GET',
      url: '/api/study/queue',
      headers: authHeaders,
    });
    assert.equal(queueRes.statusCode, 200);
    const queue = queueRes.json() as StudyQueueResponse;
    assert.ok(queue.items.length >= 4);

    const firstItem = queue.items[0]!;
    const idemKey = randomUUID();
    const futureClock = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    // 2. Submit review with far-future clientTimestamp -> accepted & clamped!
    const sync1 = await fastify.inject({
      method: 'POST',
      url: '/api/study/reviews/batch',
      headers: authHeaders,
      payload: {
        events: [
          {
            idempotencyKey: idemKey,
            cardId: firstItem.card.id,
            deckId: firstItem.card.deckId,
            rating: 'EASY',
            durationMs: 4200,
            clientTimestamp: futureClock,
          },
        ],
      },
    });
    assert.equal(sync1.statusCode, 200);
    const body1 = sync1.json() as BatchReviewSyncResponse;
    assert.equal(body1.acceptedCount, 1);
    assert.equal(body1.clampedCount, 1);
    assert.equal(body1.deduplicatedCount, 0);
    assert.equal(body1.updatedStates.length, 1);

    // 3. Re-submit exact same idempotencyKey -> deduplicated!
    const sync2 = await fastify.inject({
      method: 'POST',
      url: '/api/study/reviews/batch',
      headers: authHeaders,
      payload: {
        events: [
          {
            idempotencyKey: idemKey,
            cardId: firstItem.card.id,
            deckId: firstItem.card.deckId,
            rating: 'EASY',
            durationMs: 4200,
            clientTimestamp: futureClock,
          },
        ],
      },
    });
    assert.equal(sync2.statusCode, 200);
    const body2 = sync2.json() as BatchReviewSyncResponse;
    assert.equal(body2.acceptedCount, 0);
    assert.equal(body2.deduplicatedCount, 1);

    // 4. Fetch Analytics overview -> verify 91-day heatmap + topic retention + study time
    const analyticsRes = await fastify.inject({
      method: 'GET',
      url: '/api/analytics/overview',
      headers: authHeaders,
    });
    assert.equal(analyticsRes.statusCode, 200);
    const analytics = analyticsRes.json() as AnalyticsOverviewResponse;
    assert.equal(analytics.heatmap.length, 91);
    assert.equal(analytics.studyTimeByDay.length, 7);
    assert.ok(analytics.reviewedToday >= 1);
    assert.ok(analytics.topicRetention.length >= 1);

    await fastify.close();
  });

  it('creates live room with simulated bots, rejects <4-card decks, scores answers & creates mistakes review deck', async () => {
    const { fastify, roomEngine } = await buildApp(env, {
      roomTimings: {
        countdownMs: 60,
        revealMs: 60,
        leaderboardMs: 60,
        earlyAdvanceDelayMs: 40,
      },
    });

    const demo = await fastify.inject({ method: 'POST', url: '/api/auth/demo' });
    const { accessToken, user } = demo.json() as {
      accessToken: string;
      user: { id: string; displayName: string };
    };
    const authHeaders = { authorization: `Bearer ${accessToken}` };

    const decksRes = await fastify.inject({ method: 'GET', url: '/api/decks', headers: authHeaders });
    const { decks } = decksRes.json() as { decks: Array<{ id: string; cardCount: number }> };
    const eligibleDeck = decks.find((d) => d.cardCount >= 4);
    const tinyDeck = decks.find((d) => d.cardCount < 4);
    assert.ok(eligibleDeck);
    assert.ok(tinyDeck);

    // 1. Deck with < 4 cards is rejected
    const rejectRes = await fastify.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: authHeaders,
      payload: { deckId: tinyDeck.id, title: 'Too Small', questionCount: 4, simulatedBotsCount: 2 },
    });
    assert.equal(rejectRes.statusCode, 400);

    // 2. Eligible deck creates room with 2 Simulated Bots
    const createRes = await fastify.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: authHeaders,
      payload: {
        deckId: eligibleDeck.id,
        title: 'Live Architecture Sprint',
        questionCount: 4,
        questionDurationSec: 10,
        simulatedBotsCount: 2,
      },
    });
    assert.equal(createRes.statusCode, 201);
    const { room } = createRes.json() as { room: { code: string; botsCount: number; participantCount: number } };
    assert.equal(room.code.length, 6);
    assert.equal(room.botsCount, 2);
    assert.equal(room.participantCount, 3);

    // 3. Public room appears in GET /api/rooms
    const listRes = await fastify.inject({ method: 'GET', url: '/api/rooms', headers: authHeaders });
    assert.equal(listRes.statusCode, 200);
    const { rooms } = listRes.json() as { rooms: Array<{ code: string }> };
    assert.ok(rooms.some((r) => r.code === room.code));

    // 4. Start room -> transitions cleanly via State Machine -> submit answer -> create mistakes deck
    roomEngine.startRoom(room.code, user.id);
    await new Promise((r) => setTimeout(r, 120));
    const snap = roomEngine.buildSnapshotForUser(room.code, user.id);
    assert.equal(snap.state.phase, 'QUESTION_ACTIVE');
    assert.ok(snap.activeQuestion);

    const ans = roomEngine.submitAnswer(
      room.code,
      user.id,
      snap.activeQuestion.questionIndex,
      snap.activeQuestion.choices[0]!.id,
    );
    assert.equal(ans.accepted, true);

    const mistakesRes = await fastify.inject({
      method: 'POST',
      url: `/api/rooms/${room.code}/mistakes-deck`,
      headers: authHeaders,
      payload: { cardIds: [snap.activeQuestion.cardId] },
    });
    assert.equal(mistakesRes.statusCode, 201);
    const mistakesBody = mistakesRes.json() as { deckId: string; cardCount: number };
    assert.equal(mistakesBody.cardCount, 1);

    await fastify.close();
  });

  it('persists user preferences and Web Push subscriptions', async () => {
    const { fastify } = await buildApp(env);
    const demo = await fastify.inject({ method: 'POST', url: '/api/auth/demo' });
    const { accessToken } = demo.json() as { accessToken: string };
    const authHeaders = { authorization: `Bearer ${accessToken}` };

    const prefRes = await fastify.inject({
      method: 'PATCH',
      url: '/api/settings/preferences',
      headers: authHeaders,
      payload: { theme: 'dark', dailyGoal: 35, reminderHourLocal: 21 },
    });
    assert.equal(prefRes.statusCode, 200);
    assert.equal(
      (prefRes.json() as { user: { preferences: { dailyGoal: number } } }).user.preferences
        .dailyGoal,
      35,
    );

    const subRes = await fastify.inject({
      method: 'POST',
      url: '/api/push/subscribe',
      headers: authHeaders,
      payload: {
        endpoint: 'https://push.example.test/sub-1',
        keys: { p256dh: 'BEl62iUYgUivxIkv69yViEuiBIa', auth: 'tBHItJI5svbpez7KI4CCXg' },
      },
    });
    assert.equal(subRes.statusCode, 201);
    assert.equal((subRes.json() as { subscribed: boolean }).subscribed, true);

    const delRes = await fastify.inject({
      method: 'DELETE',
      url: '/api/push/subscribe',
      headers: authHeaders,
      payload: { endpoint: 'https://push.example.test/sub-1' },
    });
    assert.equal(delRes.statusCode, 200);
    assert.equal((delRes.json() as { subscribed: boolean }).subscribed, false);

    await fastify.close();
  });

  it('enforces production security headers (CSP, nosniff, DENY frameguard, Referrer-Policy)', async () => {
    const { fastify } = await buildApp(env);
    const res = await fastify.inject({ method: 'GET', url: '/health' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
    assert.ok(String(res.headers['content-security-policy'] ?? '').includes("default-src 'none'"));

    await fastify.close();
  });
});
