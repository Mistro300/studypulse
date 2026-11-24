import type {
  BuiltinPackSummary,
  CardDto,
  CreateCardInput,
  GenerateFromNotesInput,
  ImportQuestionsInput,
  QuestionSourceKind,
} from '@studypulse/shared';
import type { ApiEnv } from '../../config/env.js';
import { HttpError } from '../../core/errors/http-error.js';

interface BuiltinPack extends BuiltinPackSummary {
  cards: CreateCardInput[];
}

export const OPEN_TRIVIA_CATEGORIES = [
  { id: 18, name: 'Computer Science' },
  { id: 17, name: 'Science & Nature' },
  { id: 19, name: 'Mathematics' },
  { id: 9, name: 'General Knowledge' },
] as const;

const BUILTIN_PACKS: BuiltinPack[] = [
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
        back: 'إلغاء الطلبات القديمة تلقائياً عند تغير نص البحث أو مغادرة الصفحة لمنع سباق الاستجابات (Race Conditions).',
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
        back: 'A misconfigured device clock (far future or years in the past) would corrupt spaced repetition intervals if accepted blindly.',
        tags: ['FSRS-5', 'Data Integrity'],
      },
    ],
  },
  {
    id: 'backend-node-ar',
    title: 'تصميم الـ Backend وقواعد البيانات (عربي)',
    description: 'مفاهيم PostgreSQL وRedis وFastify وبناء APIs آمنة وقابلة للتوسع.',
    topic: 'Backend',
    language: 'ar',
    cardCount: 4,
    cards: [
      {
        type: 'MCQ',
        front: 'ما أفضل نمط لتخزين سجل المراجعات في PostgreSQL لدعم المزامنة الأوفلاين بلا تعارض؟',
        back: 'نمط Append-Only مع قيد `UNIQUE(user_id, idempotency_key)`.',
        choices: [
          { id: 'c1', text: 'حذف السجل القديم كل دقيقة' },
          { id: 'c2', text: 'Append-Only مع UNIQUE(user_id, idempotency_key)' },
          { id: 'c3', text: 'تخزين كل المراجعات في عمود نصي واحد' },
          { id: 'c4', text: 'الاعتماد على ذاكرة المتصفح فقط' },
        ],
        correctChoiceId: 'c2',
        tags: ['PostgreSQL', 'Sync'],
      },
      {
        type: 'FLASHCARD',
        front: 'ما الفرق بين Rate Limiting على الـ HTTP والـ WebSocket؟',
        back: 'في HTTP يُطبّق لكل IP/مستخدم على كل طلب، بينما في WebSocket يُطبّق على مستوى الأحداث داخل الاتصال المفتوح لمنع إغراق الغرفة بالإجابات أو الرسائل.',
        tags: ['Security', 'WebSockets'],
      },
      {
        type: 'MCQ',
        front: 'لماذا نستخدم `HttpOnly; SameSite=Strict` لكوكي `Refresh Token`؟',
        back: 'لمنع جافاسكربت من قراءتها (حماية ضد XSS) وتقليل خطر هجمات CSRF.',
        choices: [
          { id: 'c1', text: 'للسماح بقراءتها من `document.cookie`' },
          { id: 'c2', text: 'لحمايتها من XSS ومنع إرسالها عبر مواقع خارجية (CSRF)' },
          { id: 'c3', text: 'لزيادة حجم الكوكي إلى 10MB' },
          { id: 'c4', text: 'لإلغاء الحاجة إلى Access Token' },
        ],
        correctChoiceId: 'c2',
        tags: ['Security', 'Cookies'],
      },
      {
        type: 'FLASHCARD',
        front: 'لماذا نتحقق من عقود البيانات باستخدام Zod على الطرفين (API + Web)؟',
        back: 'لأن TypeScript يُحذف وقت التشغيل (Runtime)، بينما Zod يضمن سلامة المدخلات واستجابات الشبكة فعلياً أثناء التشغيل.',
        tags: ['TypeScript', 'Zod'],
      },
    ],
  },
];

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”');
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j]!;
    copy[j] = tmp!;
  }
  return copy;
}

export function listBuiltinPacks(): BuiltinPackSummary[] {
  return BUILTIN_PACKS.map(({ cards: _cards, ...summary }) => summary);
}

export async function importFromAdapter(
  input: ImportQuestionsInput,
): Promise<{ source: QuestionSourceKind; cards: CreateCardInput[] }> {
  if (input.source === 'BUILTIN_TECH_PACK') {
    const pack =
      BUILTIN_PACKS.find((p) => p.id === input.packId) ?? BUILTIN_PACKS[0]!;
    return {
      source: 'BUILTIN_TECH_PACK',
      cards: pack.cards.slice(0, input.amount),
    };
  }

  // OPEN_TRIVIA external API adapter
  const params = new URLSearchParams({
    amount: String(Math.min(input.amount, 15)),
    type: 'multiple',
  });
  if (input.categoryId) params.set('category', String(input.categoryId));
  if (input.difficulty) params.set('difficulty', input.difficulty);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(`https://opentdb.com/api.php?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new HttpError(502, 'INTERNAL_ERROR', 'Open Trivia DB returned an upstream error', true);
    }

    const data = (await res.json()) as {
      response_code: number;
      results?: Array<{
        category: string;
        difficulty: string;
        question: string;
        correct_answer: string;
        incorrect_answers: string[];
      }>;
    };

    if (!data.results || data.results.length === 0) {
      throw new HttpError(404, 'NOT_FOUND', 'No questions found for the chosen Open Trivia filters');
    }

    const cards: CreateCardInput[] = data.results.map((item) => {
      const correctText = decodeHtmlEntities(item.correct_answer);
      const wrongTexts = item.incorrect_answers.map(decodeHtmlEntities);
      const shuffled = shuffle([correctText, ...wrongTexts]).map((text, idx) => ({
        id: `c${idx + 1}`,
        text,
      }));
      const correctChoice = shuffled.find((c) => c.text === correctText) ?? shuffled[0]!;
      return {
        type: 'MCQ',
        front: decodeHtmlEntities(item.question),
        back: correctText,
        explanation: `Category: ${decodeHtmlEntities(item.category)} (${item.difficulty})`,
        choices: shuffled,
        correctChoiceId: correctChoice.id,
        tags: ['OpenTrivia', item.difficulty],
      };
    });

    return { source: 'OPEN_TRIVIA', cards };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(
      503,
      'NETWORK_TIMEOUT',
      'Could not reach Open Trivia DB right now. Try a Built-in Tech Pack instead.',
      true,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Deterministic Mock LLM extractor used whenever LLM_API_KEY is not configured.
 * Splits user notes into crisp study Q&A flashcards or MCQs so demos always work offline/keyless.
 */
function mockExtractCardsFromNotes(input: GenerateFromNotesInput): CreateCardInput[] {
  const lines = input.notes
    .split(/\r?\n|(?<=[.؟!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 16);

  const selected = lines.slice(0, input.maxCards);
  if (selected.length === 0) {
    selected.push(input.notes.trim().slice(0, 300));
  }

  const isAr = input.language === 'ar';

  return selected.map((segment, index) => {
    const colonSplit = segment.split(/[:：—-]/);
    const hasHeading = colonSplit.length >= 2 && colonSplit[0]!.trim().length >= 3 && colonSplit[0]!.trim().length <= 80;
    const concept = hasHeading ? colonSplit[0]!.trim() : '';
    const answer = hasHeading ? colonSplit.slice(1).join(':').trim() : segment;

    const front = concept
      ? isAr
        ? `ما المقصود بـ "${concept}"؟`
        : `Explain "${concept}" based on your notes.`
      : isAr
        ? `نقطة مراجعة #${index + 1}: لخّص الفكرة التالية واسترجع تفاصيلها:`
        : `Active Recall #${index + 1}: Recall the key concept from your notes:`;

    if (input.cardType === 'MCQ' && selected.length >= 2) {
      const distractors = selected
        .filter((_, idx) => idx !== index)
        .slice(0, 3)
        .map((other) => other.slice(0, 120));
      while (distractors.length < 3) {
        distractors.push(
          isAr ? `خيار مشتّت #${distractors.length + 1}` : `Distractor option #${distractors.length + 1}`,
        );
      }
      const correctShort = answer.slice(0, 140);
      const choices = shuffle([correctShort, ...distractors]).map((text, i) => ({
        id: `c${i + 1}`,
        text,
      }));
      const correct = choices.find((c) => c.text === correctShort) ?? choices[0]!;
      return {
        type: 'MCQ',
        front,
        back: answer,
        explanation: isAr ? 'تم توليدها تلقائياً من ملاحظاتك.' : 'Auto-extracted from your study notes.',
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

export async function generateCardsFromNotes(
  input: GenerateFromNotesInput,
  env: ApiEnv,
): Promise<{ source: QuestionSourceKind; cards: CreateCardInput[] }> {
  if (!env.LLM_API_KEY) {
    return {
      source: 'MOCK_LLM',
      cards: mockExtractCardsFromNotes(input),
    };
  }

  // OpenAI-compatible chat completions endpoint with strict JSON output fallback to mock
  const baseUrl = (env.LLM_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'Return ONLY a JSON array of study cards: [{ "type": "FLASHCARD", "front": "...", "back": "...", "tags": ["Notes"] }].',
          },
          {
            role: 'user',
            content: `Language: ${input.language}. Max cards: ${input.maxCards}. Notes:\n${input.notes}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { source: 'MOCK_LLM', cards: mockExtractCardsFromNotes(input) };
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(content) as CreateCardInput[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { source: 'MOCK_LLM', cards: mockExtractCardsFromNotes(input) };
    }
    return { source: 'LLM_NOTES', cards: parsed.slice(0, input.maxCards) };
  } catch {
    return { source: 'MOCK_LLM', cards: mockExtractCardsFromNotes(input) };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Server-side Auto-Distractor Generator:
 * Converts any FLASHCARD in a deck with >= 4 cards into a 4-choice MCQ for Live Quiz Rooms.
 */
export function buildAutoDistractorMcq(
  targetCard: CardDto,
  allDeckCards: CardDto[],
): { choices: Array<{ key: 'A' | 'B' | 'C' | 'D'; id: string; text: string }>; correctChoiceId: string } {
  const keys: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];

  if (targetCard.type === 'MCQ' && targetCard.choices && targetCard.choices.length >= 4 && targetCard.correctChoiceId) {
    const picked = targetCard.choices.slice(0, 4);
    return {
      choices: picked.map((c, idx) => ({ key: keys[idx]!, id: c.id, text: c.text })),
      correctChoiceId: targetCard.correctChoiceId,
    };
  }

  const others = shuffle(
    allDeckCards
      .filter((c) => c.id !== targetCard.id && c.back.trim() !== targetCard.back.trim())
      .map((c) => c.back.trim().slice(0, 180)),
  ).slice(0, 3);

  while (others.length < 3) {
    others.push(`Option ${others.length + 2}`);
  }

  const correctText = targetCard.back.trim().slice(0, 180);
  const rawOptions = shuffle([
    { id: 'correct', text: correctText },
    ...others.map((text, idx) => ({ id: `d${idx + 1}`, text })),
  ]);

  return {
    choices: rawOptions.map((opt, idx) => ({ key: keys[idx]!, id: opt.id, text: opt.text })),
    correctChoiceId: 'correct',
  };
}
