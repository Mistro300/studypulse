import {
  clampReviewTimestamp,
  createInitialSrsState,
  scheduleNextReview,
  type AnalyticsOverviewResponse,
  type AuthSessionResponse,
  type BatchReviewSyncInput,
  type BatchReviewSyncResponse,
  type BuiltinPackSummary,
  type CardDto,
  type CreateCardInput,
  type CreateDeckInput,
  type DeckDto,
  type GenerateFromNotesInput,
  type HeatmapDay,
  type ImportQuestionsInput,
  type PushStatusResponse,
  type SrsCardSnapshot,
  type SrsRating,
  type StudyCardWithSrs,
  type StudyDayTime,
  type StudyQueueResponse,
  type TopicRetention,
  type UpdateCardInput,
  type UpdateDeckInput,
  type UpdateOnboardingInput,
  type UpdatePreferencesInput,
  type UserProfile,
} from '@studypulse/shared';

const STORAGE_KEY = 'studypulse.standalone.db.v1';
const SESSION_KEY = 'studypulse.standalone.session.v1';

interface StandaloneUser extends UserProfile {
  password: string;
  pushRemindersEnabled: boolean;
  pushRoomInvitesEnabled: boolean;
  reminderHourLocal: number;
  pushEndpoints: string[];
}

interface StandaloneReview {
  id: string;
  userId: string;
  cardId: string;
  topic: string;
  idempotencyKey: string;
  rating: SrsRating;
  durationMs: number;
  effectiveTimestamp: string;
}

interface StandaloneDb {
  users: StandaloneUser[];
  decks: DeckDto[];
  cards: CardDto[];
  srsStates: Record<string, SrsCardSnapshot>;
  reviews: StandaloneReview[];
}

const BUILTIN_PACKS: Array<BuiltinPackSummary & { cards: CreateCardInput[] }> = [
  {
    id: 'react-ts-ar',
    title: 'هندسة React و TypeScript (عربي)',
    description: 'حزمة أسئلة تقنية مدمجة للاستعداد للمقابلات في React 19 وTypeScript الصارم.',
    topic: 'Frontend',
    language: 'ar',
    cardCount: 5,
    cards: [
      {
        type: 'MCQ',
        front: 'ما الغرض الأساسي من تفعيل `noUncheckedIndexedAccess` في TypeScript؟',
        back: 'إلزام المطور بالتعامل مع احتمال `undefined` عند الوصول لعناصر المصفوفات والكائنات بالفهرس.',
        explanation: 'يمنع أخطاء Runtime الشائعة عند قراءة عنصر غير موجود في مصفوفة.',
        choices: [
          { id: 'c1', text: 'تسريع وقت الترجمة فقط' },
          { id: 'c2', text: 'إضافة `undefined` تلقائياً عند الوصول بالفهرس للمصفوفات' },
          { id: 'c3', text: 'منع استخدام الحلقات التكرارية' },
          { id: 'c4', text: 'تحويل كل الأنواع إلى `any`' },
        ],
        correctChoiceId: 'c2',
        tags: ['TypeScript', 'Safety'],
      },
      {
        type: 'MCQ',
        front: 'لماذا نستخدم `Selectors` دقيقة في Zustand داخل شاشات WebSockets السريعة؟',
        back: 'لأن كل مكون يعيد التصيير فقط عند تغيّر الجزء الذي يشترك فيه بدلاً من كامل الحالة.',
        choices: [
          { id: 'c1', text: 'لتقليل إعادة التصيير غير الضرورية عند كل حدث فوري' },
          { id: 'c2', text: 'لأن Zustand لا يعمل بدونها إطلاقاً' },
          { id: 'c3', text: 'لتشفير رسائل WebSocket' },
          { id: 'c4', text: 'لتخزين الصور داخل المتصفح' },
        ],
        correctChoiceId: 'c1',
        tags: ['React', 'Performance'],
      },
      {
        type: 'FLASHCARD',
        front: 'كيف تمنع وميض الشاشة الأبيض (FOUC) عند تحميل الوضع الليلي في تطبيق React؟',
        back: 'عبر سكربت متزامن صغير داخل `<head>` يقرأ التفضيل المحفوظ أو `prefers-color-scheme` ويضبط `data-theme` و`<meta name="theme-color">` قبل تحميل React.',
        tags: ['PWA', 'UX'],
      },
      {
        type: 'MCQ',
        front: 'ما فائدة استخدام `AbortController` في طبقة جلب البيانات (API Client)؟',
        back: 'إلغاء الطلبات القديمة تلقائياً عند تغير نص البحث أو مغادرة الصفحة لمنع Race Conditions.',
        choices: [
          { id: 'c1', text: 'ضغط ملفات CSS' },
          { id: 'c2', text: 'إلغاء الطلبات الملغاة ومنع Race Conditions' },
          { id: 'c3', text: 'حفظ البيانات في IndexedDB' },
          { id: 'c4', text: 'تسجيل Service Worker' },
        ],
        correctChoiceId: 'c2',
        tags: ['Networking', 'React'],
      },
      {
        type: 'FLASHCARD',
        front: 'ما هي قاعدة فصل الأخطاء في المصادقة الأوفلاين (Offline Auth Continuity)؟',
        back: 'لا يُطرد المستخدم عند فشل الشبكة (`Offline/NetworkError`) بل تُفتح المذاكرة المحلية عبر `cached_session_profile`؛ ولا يظهر مودال `401 Session Expired` إلا عند رفض فعلي من السيرفر.',
        tags: ['Offline-First', 'Auth'],
      },
    ],
  },
  {
    id: 'pwa-system-design-en',
    title: 'PWA, Offline-First & System Design (English)',
    description: 'Production architecture questions on Service Workers, FSRS-5, Redis, and WebSockets.',
    topic: 'System Design',
    language: 'en',
    cardCount: 5,
    cards: [
      {
        type: 'MCQ',
        front: 'Why must explicit logout clear IndexedDB and runtime Workbox caches in a PWA?',
        back: 'To prevent leaking private offline decks or session profiles on shared devices.',
        choices: [
          { id: 'c1', text: 'To prevent user data leaks on shared devices' },
          { id: 'c2', text: 'Because browsers delete localStorage automatically' },
          { id: 'c3', text: 'To speed up DNS resolution' },
          { id: 'c4', text: 'Because HTTPS requires empty IndexedDB' },
        ],
        correctChoiceId: 'c1',
        tags: ['Security', 'PWA'],
      },
      {
        type: 'MCQ',
        front: 'What happens on the server when a previously rotated Refresh Token is replayed?',
        back: 'The entire token `family_id` is revoked immediately to terminate compromised sessions.',
        choices: [
          { id: 'c1', text: 'The server silently issues a new token' },
          { id: 'c2', text: 'The server revokes the entire token family immediately' },
          { id: 'c3', text: 'The token TTL is doubled' },
          { id: 'c4', text: 'The client retries with HTTP 200' },
        ],
        correctChoiceId: 'c2',
        tags: ['Auth', 'Security'],
      },
      {
        type: 'FLASHCARD',
        front: 'Why run `ts-fsrs` with `enable_fuzz: false` in a shared monorepo package?',
        back: 'So offline client previews and server-side replay compute the exact same deterministic FSRS-5 schedule.',
        tags: ['FSRS-5', 'Architecture'],
      },
      {
        type: 'MCQ',
        front: 'Why should ephemeral live quiz room state live in Redis with a sliding TTL?',
        back: 'For sub-millisecond reads/writes across socket workers and automatic cleanup of abandoned rooms.',
        choices: [
          { id: 'c1', text: 'Redis replaces CSS stylesheets' },
          { id: 'c2', text: 'Fast in-memory reads/writes and automatic TTL cleanup' },
          { id: 'c3', text: 'PostgreSQL cannot store UUIDs' },
          { id: 'c4', text: 'WebSockets require Redis to open a port' },
        ],
        correctChoiceId: 'c2',
        tags: ['Redis', 'Realtime'],
      },
      {
        type: 'FLASHCARD',
        front: 'Why clamp `clientTimestamp` on the server for offline FSRS review events?',
        back: 'A misconfigured device clock would corrupt spaced repetition intervals if accepted blindly.',
        tags: ['FSRS-5', 'Data Integrity'],
      },
    ],
  },
];

const OPEN_TRIVIA_CATEGORIES = [
  { id: 18, name: 'Computer Science' },
  { id: 17, name: 'Science & Nature' },
  { id: 19, name: 'Mathematics' },
  { id: 9, name: 'General Knowledge' },
];

function isValidHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!/^https?:\/\/[a-z0-9.-]+/i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isStandaloneMode(): boolean {
  const configuredApi = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (isValidHttpUrl(configuredApi)) return false;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

function createSeededDb(): StandaloneDb {
  const now = new Date();
  const nowIso = now.toISOString();
  const demoUserId = '11111111-1111-4111-8111-111111111111';
  const arDeckId = '22222222-2222-4222-8222-222222222221';
  const enDeckId = '22222222-2222-4222-8222-222222222222';

  const demoUser: StandaloneUser = {
    id: demoUserId,
    email: 'demo@studypulse.app',
    password: 'StudyPulse123!',
    displayName: 'Ahmed Mostafa',
    avatarUrl: null,
    streakDays: 3,
    preferences: {
      theme: 'system',
      locale: 'ar',
      dailyGoal: 20,
      interests: ['Frontend', 'System Design', 'PWA'],
      onboardingCompleted: true,
    },
    pushRemindersEnabled: false,
    pushRoomInvitesEnabled: true,
    reminderHourLocal: 20,
    pushEndpoints: [],
  };

  const arCards: CardDto[] = BUILTIN_PACKS[0]!.cards.slice(0, 4).map((c, idx) => ({
    id: `33333333-3333-4333-8333-33333333330${idx + 1}`,
    deckId: arDeckId,
    type: c.type,
    front: c.front,
    back: c.back,
    explanation: c.explanation ?? null,
    choices: c.type === 'MCQ' ? (c.choices ?? null) : null,
    correctChoiceId: c.type === 'MCQ' ? (c.correctChoiceId ?? null) : null,
    tags: c.tags ?? [],
    createdAt: nowIso,
    updatedAt: nowIso,
  }));

  const enCards: CardDto[] = BUILTIN_PACKS[1]!.cards.slice(0, 2).map((c, idx) => ({
    id: `33333333-3333-4333-8333-33333333340${idx + 1}`,
    deckId: enDeckId,
    type: c.type,
    front: c.front,
    back: c.back,
    explanation: c.explanation ?? null,
    choices: c.type === 'MCQ' ? (c.choices ?? null) : null,
    correctChoiceId: c.type === 'MCQ' ? (c.correctChoiceId ?? null) : null,
    tags: c.tags ?? [],
    createdAt: nowIso,
    updatedAt: nowIso,
  }));

  const decks: DeckDto[] = [
    {
      id: arDeckId,
      ownerId: demoUserId,
      title: 'أساسيات React و TypeScript للمقابلات',
      description: 'رزمة مبدئية تجمع بين بطاقات الاستدعاء النشط وأسئلة الاختيار من متعدد للغرف الحية.',
      topic: 'Frontend',
      language: 'ar',
      isPublic: true,
      cardCount: arCards.length,
      dueCount: arCards.length,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: enDeckId,
      ownerId: demoUserId,
      title: 'System Design & Realtime WebSockets',
      description: 'Core engineering concepts for resilient real-time quiz & PWA apps.',
      topic: 'System Design',
      language: 'en',
      isPublic: true,
      cardCount: enCards.length,
      dueCount: enCards.length,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  // Historical reviews for the Violet Contribution Heatmap
  const reviews: StandaloneReview[] = [];
  const seedPattern = [
    { daysAgo: 28, count: 4, topic: 'Frontend', cardId: arCards[0]!.id },
    { daysAgo: 21, count: 9, topic: 'System Design', cardId: enCards[0]!.id },
    { daysAgo: 14, count: 12, topic: 'Frontend', cardId: arCards[1]!.id },
    { daysAgo: 6, count: 8, topic: 'Frontend', cardId: arCards[2]!.id },
    { daysAgo: 4, count: 14, topic: 'System Design', cardId: enCards[1]!.id },
    { daysAgo: 2, count: 7, topic: 'Frontend', cardId: arCards[0]!.id },
    { daysAgo: 1, count: 10, topic: 'Frontend', cardId: arCards[1]!.id },
  ];
  const ratings: SrsRating[] = ['GOOD', 'GOOD', 'EASY', 'HARD', 'GOOD', 'AGAIN'];
  for (const item of seedPattern) {
    for (let i = 0; i < item.count; i += 1) {
      const ts = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - item.daysAgo, 18, i * 3),
      );
      reviews.push({
        id: crypto.randomUUID(),
        userId: demoUserId,
        cardId: item.cardId,
        topic: item.topic,
        idempotencyKey: crypto.randomUUID(),
        rating: ratings[i % ratings.length]!,
        durationMs: 3200 + (i % 4) * 850,
        effectiveTimestamp: ts.toISOString(),
      });
    }
  }

  return {
    users: [demoUser],
    decks,
    cards: [...arCards, ...enCards],
    srsStates: {},
    reviews,
  };
}

export function loadStandaloneDb(): StandaloneDb {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StandaloneDb;
      const demoUser = parsed.users?.find((u) => u.email === 'demo@studypulse.app');
      if (demoUser && demoUser.displayName === 'Mohamed Bahaa') {
        demoUser.displayName = 'Ahmed Mostafa';
        saveStandaloneDb(parsed);
      }
      return parsed;
    }
  } catch {
    // Re-seed below
  }
  const seeded = createSeededDb();
  saveStandaloneDb(seeded);
  return seeded;
}

export function saveStandaloneDb(db: StandaloneDb): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Ignore storage quota errors
  }
}

export function getStandaloneUserId(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function setStandaloneUserId(userId: string | null): void {
  try {
    if (userId) window.localStorage.setItem(SESSION_KEY, userId);
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore
  }
}

function toPublicUser(u: StandaloneUser): UserProfile {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    streakDays: u.streakDays,
    preferences: u.preferences,
  };
}

function makeSession(u: StandaloneUser): AuthSessionResponse {
  setStandaloneUserId(u.id);
  return {
    accessToken: `standalone.${u.id}`,
    expiresInSec: 3600,
    user: toPublicUser(u),
  };
}

function requireCurrentUser(db: StandaloneDb): StandaloneUser {
  const uid = getStandaloneUserId();
  const user = db.users.find((u) => u.id === uid);
  if (!user) {
    throw Object.assign(new Error('Authentication required'), {
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }
  return user;
}

function withCounts(deck: DeckDto, db: StandaloneDb, userId: string): DeckDto {
  const nowMs = Date.now();
  const deckCards = db.cards.filter((c) => c.deckId === deck.id);
  const dueCount = deckCards.filter((c) => {
    const srs = db.srsStates[`${userId}:${c.id}`];
    return !srs || new Date(srs.due).getTime() <= nowMs;
  }).length;
  return { ...deck, cardCount: deckCards.length, dueCount };
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

function extractCardsFromNotes(input: GenerateFromNotesInput): CreateCardInput[] {
  const lines = input.notes
    .split(/\r?\n|(?<=[.؟!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 16)
    .slice(0, input.maxCards);

  if (lines.length === 0) lines.push(input.notes.trim().slice(0, 300));
  const isAr = input.language === 'ar';

  return lines.map((segment, index) => {
    const split = segment.split(/[:：—-]/);
    const hasHeading = split.length >= 2 && split[0]!.trim().length >= 3 && split[0]!.trim().length <= 80;
    const concept = hasHeading ? split[0]!.trim() : '';
    const answer = hasHeading ? split.slice(1).join(':').trim() : segment;
    const front = concept
      ? isAr
        ? `ما المقصود بـ "${concept}"؟`
        : `Explain "${concept}" based on your notes.`
      : isAr
        ? `نقطة مراجعة #${index + 1}: لخّص الفكرة التالية:`
        : `Active Recall #${index + 1}: Recall the key concept:`;

    if (input.cardType === 'MCQ' && lines.length >= 2) {
      const distractors = lines
        .filter((_, i) => i !== index)
        .slice(0, 3)
        .map((s) => s.slice(0, 120));
      while (distractors.length < 3) distractors.push(`Option #${distractors.length + 2}`);
      const correctShort = answer.slice(0, 140);
      const choices = shuffle([correctShort, ...distractors]).map((text, idx) => ({
        id: `c${idx + 1}`,
        text,
      }));
      const correct = choices.find((c) => c.text === correctShort) ?? choices[0]!;
      return {
        type: 'MCQ',
        front,
        back: answer,
        explanation: isAr ? 'تم توليدها تلقائياً من ملاحظاتك.' : 'Auto-extracted from your notes.',
        choices,
        correctChoiceId: correct.id,
        tags: ['Notes', 'AutoGenerated'],
      };
    }

    return {
      type: 'FLASHCARD',
      front,
      back: answer,
      explanation: isAr ? 'مستخلصة من ملاحظات المستخدم.' : 'Extracted from user notes.',
      tags: ['Notes', 'AutoGenerated'],
    };
  });
}

function buildAnalytics(db: StandaloneDb, user: StandaloneUser): AnalyticsOverviewResponse {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const userReviews = db.reviews.filter((r) => r.userId === user.id);

  const countByDate = new Map<string, number>();
  const durationByDate = new Map<string, number>();
  const topicStats = new Map<string, { total: number; passed: number }>();

  let passedTotal = 0;
  let totalDurationMs = 0;

  for (const r of userReviews) {
    const key = r.effectiveTimestamp.slice(0, 10);
    countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
    durationByDate.set(key, (durationByDate.get(key) ?? 0) + r.durationMs);
    const passed = r.rating === 'GOOD' || r.rating === 'EASY';
    if (passed) passedTotal += 1;
    totalDurationMs += r.durationMs;
    const t = topicStats.get(r.topic) ?? { total: 0, passed: 0 };
    t.total += 1;
    if (passed) t.passed += 1;
    topicStats.set(r.topic, t);
  }

  const toLevel = (count: number): 0 | 1 | 2 | 3 | 4 =>
    count <= 0 ? 0 : count <= 3 ? 1 : count <= 8 ? 2 : count <= 15 ? 3 : 4;

  const heatmap: HeatmapDay[] = [];
  for (let offset = 90; offset >= 0; offset -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
    const key = d.toISOString().slice(0, 10);
    const count = countByDate.get(key) ?? 0;
    heatmap.push({ date: key, count, level: toLevel(count) });
  }

  const studyTimeByDay: StudyDayTime[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
    const key = d.toISOString().slice(0, 10);
    studyTimeByDay.push({
      date: key,
      reviews: countByDate.get(key) ?? 0,
      minutes: Math.round(((durationByDate.get(key) ?? 0) / 60_000) * 10) / 10,
    });
  }

  const dueByTopic = new Map<string, number>();
  for (const d of db.decks.filter((dk) => dk.ownerId === user.id)) {
    const counted = withCounts(d, db, user.id);
    dueByTopic.set(d.topic, (dueByTopic.get(d.topic) ?? 0) + counted.dueCount);
  }

  const topics = new Set<string>([...topicStats.keys(), ...dueByTopic.keys()]);
  const topicRetention: TopicRetention[] = Array.from(topics).map((topic) => {
    const s = topicStats.get(topic);
    const reviewedCount = s?.total ?? 0;
    return {
      topic,
      reviewedCount,
      retentionRatePct: reviewedCount > 0 ? Math.round(((s?.passed ?? 0) / reviewedCount) * 100) : 0,
      dueCount: dueByTopic.get(topic) ?? 0,
    };
  });

  const totalReviews = userReviews.length;
  return {
    streakDays: user.streakDays,
    totalReviews,
    retentionRatePct: totalReviews > 0 ? Math.round((passedTotal / totalReviews) * 100) : 0,
    averageResponseMs: totalReviews > 0 ? Math.round(totalDurationMs / totalReviews) : 0,
    reviewedToday: countByDate.get(todayKey) ?? 0,
    dailyGoal: user.preferences.dailyGoal,
    heatmap,
    topicRetention,
    studyTimeByDay,
  };
}

export async function handleStandaloneApiRequest(
  path: string,
  method: string,
  body?: unknown,
): Promise<unknown> {
  const url = new URL(path, 'https://standalone.studypulse.local');
  const pathname = url.pathname;
  const db = loadStandaloneDb();

  // --- AUTH ---
  if (pathname === '/api/auth/demo' && method === 'POST') {
    const demo = db.users.find((u) => u.email === 'demo@studypulse.app') ?? db.users[0]!;
    return makeSession(demo);
  }

  if (pathname === '/api/auth/register' && method === 'POST') {
    const input = body as { email: string; password: string; displayName: string; locale?: 'ar' | 'en' };
    const normalized = input.email.trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === normalized)) {
      throw Object.assign(new Error('An account with this email already exists'), {
        statusCode: 409,
        code: 'CONFLICT',
      });
    }
    const newUser: StandaloneUser = {
      id: crypto.randomUUID(),
      email: normalized,
      password: input.password,
      displayName: input.displayName.trim(),
      avatarUrl: null,
      streakDays: 1,
      preferences: {
        theme: 'system',
        locale: input.locale ?? 'ar',
        dailyGoal: 20,
        interests: [],
        onboardingCompleted: false,
      },
      pushRemindersEnabled: false,
      pushRoomInvitesEnabled: true,
      reminderHourLocal: 20,
      pushEndpoints: [],
    };
    db.users.push(newUser);
    // Give newly registered users starter bilingual decks too!
    const nowIso = new Date().toISOString();
    const starterDeckId = crypto.randomUUID();
    db.decks.push({
      id: starterDeckId,
      ownerId: newUser.id,
      title: 'أساسيات React و TypeScript للمقابلات',
      description: 'رزمة مبدئية جاهزة للمذاكرة والغرف الحية.',
      topic: 'Frontend',
      language: 'ar',
      isPublic: true,
      cardCount: 4,
      dueCount: 4,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    for (const c of BUILTIN_PACKS[0]!.cards.slice(0, 4)) {
      db.cards.push({
        id: crypto.randomUUID(),
        deckId: starterDeckId,
        type: c.type,
        front: c.front,
        back: c.back,
        explanation: c.explanation ?? null,
        choices: c.type === 'MCQ' ? (c.choices ?? null) : null,
        correctChoiceId: c.type === 'MCQ' ? (c.correctChoiceId ?? null) : null,
        tags: c.tags ?? [],
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
    saveStandaloneDb(db);
    return makeSession(newUser);
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const input = body as { email: string; password: string };
    const user = db.users.find(
      (u) => u.email.toLowerCase() === input.email.trim().toLowerCase() && u.password === input.password,
    );
    if (!user) {
      throw Object.assign(new Error('Invalid email or password'), {
        statusCode: 401,
        code: 'UNAUTHORIZED',
      });
    }
    return makeSession(user);
  }

  if (pathname === '/api/auth/refresh' && method === 'POST') {
    const uid = getStandaloneUserId();
    const user = db.users.find((u) => u.id === uid);
    if (!user) {
      throw Object.assign(new Error('Refresh token missing'), {
        statusCode: 401,
        code: 'UNAUTHORIZED',
      });
    }
    return makeSession(user);
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    setStandaloneUserId(null);
    return { ok: true };
  }

  const user = requireCurrentUser(db);

  if (pathname === '/api/auth/me' && method === 'GET') {
    return { user: toPublicUser(user) };
  }

  if (pathname === '/api/auth/onboarding' && method === 'PATCH') {
    const input = body as UpdateOnboardingInput;
    user.preferences = {
      ...user.preferences,
      interests: input.interests,
      dailyGoal: input.dailyGoal,
      locale: input.locale ?? user.preferences.locale,
      theme: input.theme ?? user.preferences.theme,
      onboardingCompleted: true,
    };
    saveStandaloneDb(db);
    return { user: toPublicUser(user) };
  }

  // --- SOURCES ---
  if (pathname === '/api/sources/packs' && method === 'GET') {
    return {
      builtinPacks: BUILTIN_PACKS.map(({ cards: _c, ...summary }) => summary),
      openTriviaCategories: OPEN_TRIVIA_CATEGORIES,
      llmConfigured: false,
    };
  }

  // --- DECKS & CARDS ---
  if (pathname === '/api/decks' && method === 'GET') {
    const q = url.searchParams.get('search')?.trim().toLowerCase();
    const topic = url.searchParams.get('topic')?.toLowerCase();
    const lang = url.searchParams.get('language');
    const decks = db.decks
      .filter((d) => {
        if (d.ownerId !== user.id) return false;
        if (topic && d.topic.toLowerCase() !== topic) return false;
        if (lang && d.language !== lang) return false;
        if (
          q &&
          !d.title.toLowerCase().includes(q) &&
          !(d.description ?? '').toLowerCase().includes(q) &&
          !d.topic.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .map((d) => withCounts(d, db, user.id))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { decks };
  }

  if (pathname === '/api/decks' && method === 'POST') {
    const input = body as CreateDeckInput;
    const nowIso = new Date().toISOString();
    const deck: DeckDto = {
      id: crypto.randomUUID(),
      ownerId: user.id,
      title: input.title,
      description: input.description ?? null,
      topic: input.topic,
      language: input.language ?? 'ar',
      isPublic: input.isPublic ?? false,
      cardCount: 0,
      dueCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    db.decks.push(deck);
    saveStandaloneDb(db);
    return { deck };
  }

  const deckMatch = /^\/api\/decks\/([^/]+)$/.exec(pathname);
  if (deckMatch) {
    const deckId = deckMatch[1]!;
    const deckIdx = db.decks.findIndex((d) => d.id === deckId && (d.ownerId === user.id || d.isPublic));
    if (deckIdx === -1) {
      throw Object.assign(new Error('Deck not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    if (method === 'GET') {
      const deck = withCounts(db.decks[deckIdx]!, db, user.id);
      const cards = db.cards.filter((c) => c.deckId === deckId);
      return { deck, cards };
    }
    if (method === 'PATCH') {
      const input = body as UpdateDeckInput;
      db.decks[deckIdx] = {
        ...db.decks[deckIdx]!,
        ...input,
        updatedAt: new Date().toISOString(),
      };
      saveStandaloneDb(db);
      return { deck: withCounts(db.decks[deckIdx]!, db, user.id) };
    }
    if (method === 'DELETE') {
      db.decks.splice(deckIdx, 1);
      db.cards = db.cards.filter((c) => c.deckId !== deckId);
      saveStandaloneDb(db);
      return { ok: true };
    }
  }

  const cardsMatch = /^\/api\/decks\/([^/]+)\/cards$/.exec(pathname);
  if (cardsMatch && method === 'POST') {
    const deckId = cardsMatch[1]!;
    const input = body as CreateCardInput;
    const nowIso = new Date().toISOString();
    const card: CardDto = {
      id: crypto.randomUUID(),
      deckId,
      type: input.type ?? 'FLASHCARD',
      front: input.front,
      back: input.back,
      explanation: input.explanation ?? null,
      choices: input.type === 'MCQ' ? (input.choices ?? null) : null,
      correctChoiceId: input.type === 'MCQ' ? (input.correctChoiceId ?? null) : null,
      tags: input.tags ?? [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    db.cards.push(card);
    saveStandaloneDb(db);
    return { card };
  }

  const cardItemMatch = /^\/api\/decks\/([^/]+)\/cards\/([^/]+)$/.exec(pathname);
  if (cardItemMatch) {
    const [, deckId, cardId] = cardItemMatch;
    const idx = db.cards.findIndex((c) => c.id === cardId && c.deckId === deckId);
    if (idx === -1) {
      throw Object.assign(new Error('Card not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    if (method === 'PATCH') {
      const input = body as UpdateCardInput;
      const existing = db.cards[idx]!;
      const nextType = input.type ?? existing.type;
      db.cards[idx] = {
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
      saveStandaloneDb(db);
      return { card: db.cards[idx] };
    }
    if (method === 'DELETE') {
      db.cards.splice(idx, 1);
      saveStandaloneDb(db);
      return { ok: true };
    }
  }

  const importMatch = /^\/api\/decks\/([^/]+)\/import$/.exec(pathname);
  if (importMatch && method === 'POST') {
    const deckId = importMatch[1]!;
    const input = body as ImportQuestionsInput;
    let toCreate: CreateCardInput[] = [];
    let source: 'BUILTIN_TECH_PACK' | 'OPEN_TRIVIA' = 'BUILTIN_TECH_PACK';

    if (input.source === 'BUILTIN_TECH_PACK') {
      const pack = BUILTIN_PACKS.find((p) => p.id === input.packId) ?? BUILTIN_PACKS[0]!;
      toCreate = pack.cards.slice(0, input.amount ?? 5);
    } else {
      source = 'OPEN_TRIVIA';
      const params = new URLSearchParams({
        amount: String(Math.min(input.amount ?? 5, 15)),
        type: 'multiple',
      });
      if (input.categoryId) params.set('category', String(input.categoryId));
      const res = await fetch(`https://opentdb.com/api.php?${params.toString()}`);
      const json = (await res.json()) as {
        results?: Array<{
          category: string;
          difficulty: string;
          question: string;
          correct_answer: string;
          incorrect_answers: string[];
        }>;
      };
      toCreate = (json.results ?? []).map((item) => {
        const correctText = decodeHtmlEntities(item.correct_answer);
        const options = shuffle([correctText, ...item.incorrect_answers.map(decodeHtmlEntities)]).map(
          (text, i) => ({ id: `c${i + 1}`, text }),
        );
        const correct = options.find((c) => c.text === correctText) ?? options[0]!;
        return {
          type: 'MCQ',
          front: decodeHtmlEntities(item.question),
          back: correctText,
          explanation: `${decodeHtmlEntities(item.category)} (${item.difficulty})`,
          choices: options,
          correctChoiceId: correct.id,
          tags: ['OpenTrivia', item.difficulty],
        };
      });
    }

    const nowIso = new Date().toISOString();
    const created: CardDto[] = toCreate.map((c) => ({
      id: crypto.randomUUID(),
      deckId,
      type: c.type,
      front: c.front,
      back: c.back,
      explanation: c.explanation ?? null,
      choices: c.type === 'MCQ' ? (c.choices ?? null) : null,
      correctChoiceId: c.type === 'MCQ' ? (c.correctChoiceId ?? null) : null,
      tags: c.tags ?? [],
      createdAt: nowIso,
      updatedAt: nowIso,
    }));
    db.cards.push(...created);
    saveStandaloneDb(db);
    return { source, importedCount: created.length, cards: created };
  }

  const genMatch = /^\/api\/decks\/([^/]+)\/generate-from-notes$/.exec(pathname);
  if (genMatch && method === 'POST') {
    const deckId = genMatch[1]!;
    const input = body as GenerateFromNotesInput;
    const toCreate = extractCardsFromNotes(input);
    const nowIso = new Date().toISOString();
    const created: CardDto[] = toCreate.map((c) => ({
      id: crypto.randomUUID(),
      deckId,
      type: c.type,
      front: c.front,
      back: c.back,
      explanation: c.explanation ?? null,
      choices: c.type === 'MCQ' ? (c.choices ?? null) : null,
      correctChoiceId: c.type === 'MCQ' ? (c.correctChoiceId ?? null) : null,
      tags: c.tags ?? [],
      createdAt: nowIso,
      updatedAt: nowIso,
    }));
    db.cards.push(...created);
    saveStandaloneDb(db);
    return { source: 'MOCK_LLM', importedCount: created.length, cards: created };
  }

  // --- STUDY & ANALYTICS (FSRS-5) ---
  if (pathname === '/api/study/queue' && method === 'GET') {
    const deckId = url.searchParams.get('deckId');
    const nowMs = Date.now();
    const todayKey = new Date().toISOString().slice(0, 10);
    const items: StudyCardWithSrs[] = [];

    for (const card of db.cards) {
      const deck = db.decks.find((d) => d.id === card.deckId);
      if (!deck || (deck.ownerId !== user.id && !deck.isPublic)) continue;
      if (deckId && deck.id !== deckId) continue;
      const srs = db.srsStates[`${user.id}:${card.id}`] ?? null;
      if (!srs || new Date(srs.due).getTime() <= nowMs) {
        items.push({ card, deckTitle: deck.title, srs });
      }
    }

    const reviewedToday = db.reviews.filter(
      (r) => r.userId === user.id && r.effectiveTimestamp.slice(0, 10) === todayKey,
    ).length;

    return {
      items: items.slice(0, 30),
      dueTotal: items.length,
      reviewedToday,
      dailyGoal: user.preferences.dailyGoal,
    } satisfies StudyQueueResponse;
  }

  if (pathname === '/api/study/reviews/batch' && method === 'POST') {
    const input = body as BatchReviewSyncInput;
    const serverNow = new Date();
    let acceptedCount = 0;
    let deduplicatedCount = 0;
    let clampedCount = 0;
    const updatedStates: Array<{ cardId: string; srs: SrsCardSnapshot }> = [];

    for (const ev of input.events) {
      if (db.reviews.some((r) => r.userId === user.id && r.idempotencyKey === ev.idempotencyKey)) {
        deduplicatedCount += 1;
        continue;
      }
      const card = db.cards.find((c) => c.id === ev.cardId);
      const deck = card ? db.decks.find((d) => d.id === card.deckId) : undefined;
      if (!card || !deck) continue;

      const { effectiveTimestamp, wasClamped } = clampReviewTimestamp(
        new Date(ev.clientTimestamp),
        serverNow,
      );
      if (wasClamped) clampedCount += 1;

      const key = `${user.id}:${card.id}`;
      const current = db.srsStates[key] ?? createInitialSrsState(effectiveTimestamp);
      const next = scheduleNextReview(current, ev.rating, effectiveTimestamp);
      db.srsStates[key] = next;
      db.reviews.push({
        id: crypto.randomUUID(),
        userId: user.id,
        cardId: card.id,
        topic: deck.topic,
        idempotencyKey: ev.idempotencyKey,
        rating: ev.rating,
        durationMs: ev.durationMs,
        effectiveTimestamp: effectiveTimestamp.toISOString(),
      });
      updatedStates.push({ cardId: card.id, srs: next });
      acceptedCount += 1;
    }

    if (acceptedCount > 0) user.streakDays = Math.max(1, user.streakDays);
    saveStandaloneDb(db);

    return {
      acceptedCount,
      deduplicatedCount,
      clampedCount,
      streakDays: user.streakDays,
      updatedStates,
    } satisfies BatchReviewSyncResponse;
  }

  if (pathname === '/api/analytics/overview' && method === 'GET') {
    return buildAnalytics(db, user);
  }

  // --- SETTINGS & PUSH ---
  if (pathname === '/api/settings/preferences' && method === 'PATCH') {
    const input = body as UpdatePreferencesInput;
    user.preferences = {
      ...user.preferences,
      ...(input.theme ? { theme: input.theme } : {}),
      ...(input.locale ? { locale: input.locale } : {}),
      ...(input.dailyGoal ? { dailyGoal: input.dailyGoal } : {}),
    };
    if (input.pushRemindersEnabled !== undefined) {
      user.pushRemindersEnabled = input.pushRemindersEnabled;
    }
    if (input.pushRoomInvitesEnabled !== undefined) {
      user.pushRoomInvitesEnabled = input.pushRoomInvitesEnabled;
    }
    if (input.reminderHourLocal !== undefined) {
      user.reminderHourLocal = input.reminderHourLocal;
    }
    saveStandaloneDb(db);
    return { user: toPublicUser(user) };
  }

  if (pathname === '/api/push/status' && method === 'GET') {
    return {
      subscribed: user.pushEndpoints.length > 0,
      subscriptionCount: user.pushEndpoints.length,
      vapidPublicKey: null,
      pushRemindersEnabled: user.pushRemindersEnabled,
      pushRoomInvitesEnabled: user.pushRoomInvitesEnabled,
      reminderHourLocal: user.reminderHourLocal,
    } satisfies PushStatusResponse;
  }

  if (pathname === '/api/push/subscribe' && method === 'POST') {
    const sub = body as { endpoint: string };
    if (!user.pushEndpoints.includes(sub.endpoint)) user.pushEndpoints.push(sub.endpoint);
    user.pushRemindersEnabled = true;
    saveStandaloneDb(db);
    return {
      subscribed: true,
      subscriptionCount: user.pushEndpoints.length,
      vapidPublicKey: null,
      pushRemindersEnabled: user.pushRemindersEnabled,
      pushRoomInvitesEnabled: user.pushRoomInvitesEnabled,
      reminderHourLocal: user.reminderHourLocal,
    } satisfies PushStatusResponse;
  }

  if (pathname === '/api/push/subscribe' && method === 'DELETE') {
    const { endpoint } = body as { endpoint: string };
    user.pushEndpoints = user.pushEndpoints.filter((e) => e !== endpoint);
    saveStandaloneDb(db);
    return {
      subscribed: user.pushEndpoints.length > 0,
      subscriptionCount: user.pushEndpoints.length,
      vapidPublicKey: null,
      pushRemindersEnabled: user.pushRemindersEnabled,
      pushRoomInvitesEnabled: user.pushRoomInvitesEnabled,
      reminderHourLocal: user.reminderHourLocal,
    } satisfies PushStatusResponse;
  }

  // --- LIVE ROOMS (Delegated to standalone room engine) ---
  const { handleStandaloneRoomApi } = await import('./standalone-room-engine');
  return handleStandaloneRoomApi(pathname, method, body, db, user);
}
