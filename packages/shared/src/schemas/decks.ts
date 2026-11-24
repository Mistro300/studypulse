import { z } from 'zod';
import { CardChoiceSchema, CardSchema, CardTypeSchema, DeckSchema, LocaleSchema } from './core';
import { QuestionSourceKindSchema } from './live-room';

export const CreateDeckInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  topic: z.string().trim().min(2).max(60),
  language: LocaleSchema.default('ar'),
  isPublic: z.boolean().default(false),
});
export type CreateDeckInput = z.infer<typeof CreateDeckInputSchema>;

export const UpdateDeckInputSchema = CreateDeckInputSchema.partial();
export type UpdateDeckInput = z.infer<typeof UpdateDeckInputSchema>;

const BaseCardInputSchema = z.object({
  type: CardTypeSchema.default('FLASHCARD'),
  front: z.string().trim().min(2).max(2000),
  back: z.string().trim().min(1).max(4000),
  explanation: z.string().trim().max(4000).nullable().optional(),
  choices: z.array(CardChoiceSchema).min(2).max(6).nullable().optional(),
  correctChoiceId: z.string().min(1).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
});

export const CreateCardInputSchema = BaseCardInputSchema.superRefine((val, ctx) => {
  if (val.type === 'MCQ') {
    if (!val.choices || val.choices.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choices'],
        message: 'MCQ cards require at least 2 choices',
      });
      return;
    }
    if (!val.correctChoiceId || !val.choices.some((c) => c.id === val.correctChoiceId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correctChoiceId'],
        message: 'correctChoiceId must match one of the provided choices',
      });
    }
  }
});
export type CreateCardInput = z.infer<typeof CreateCardInputSchema>;

export const UpdateCardInputSchema = BaseCardInputSchema.partial().superRefine((val, ctx) => {
  if (val.type === 'MCQ' && val.choices) {
    if (!val.correctChoiceId || !val.choices.some((c) => c.id === val.correctChoiceId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correctChoiceId'],
        message: 'correctChoiceId must match one of the provided choices',
      });
    }
  }
});
export type UpdateCardInput = z.infer<typeof UpdateCardInputSchema>;

export const DeckListResponseSchema = z.object({
  decks: z.array(DeckSchema),
});
export type DeckListResponse = z.infer<typeof DeckListResponseSchema>;

export const DeckDetailResponseSchema = z.object({
  deck: DeckSchema,
  cards: z.array(CardSchema),
});
export type DeckDetailResponse = z.infer<typeof DeckDetailResponseSchema>;

export const BuiltinPackSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  topic: z.string(),
  language: LocaleSchema,
  cardCount: z.number().int().positive(),
});
export type BuiltinPackSummary = z.infer<typeof BuiltinPackSummarySchema>;

export const QuestionSourcesResponseSchema = z.object({
  builtinPacks: z.array(BuiltinPackSummarySchema),
  openTriviaCategories: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
    }),
  ),
  llmConfigured: z.boolean(),
});
export type QuestionSourcesResponse = z.infer<typeof QuestionSourcesResponseSchema>;

export const ImportQuestionsInputSchema = z.object({
  source: z.enum(['BUILTIN_TECH_PACK', 'OPEN_TRIVIA']),
  packId: z.string().optional(),
  categoryId: z.number().int().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  amount: z.number().int().min(1).max(20).default(6),
});
export type ImportQuestionsInput = z.infer<typeof ImportQuestionsInputSchema>;

export const GenerateFromNotesInputSchema = z.object({
  notes: z.string().trim().min(30).max(8000),
  maxCards: z.number().int().min(2).max(15).default(6),
  cardType: CardTypeSchema.default('FLASHCARD'),
  language: LocaleSchema.default('ar'),
});
export type GenerateFromNotesInput = z.infer<typeof GenerateFromNotesInputSchema>;

export const ImportResultResponseSchema = z.object({
  source: QuestionSourceKindSchema,
  importedCount: z.number().int().nonnegative(),
  cards: z.array(CardSchema),
});
export type ImportResultResponse = z.infer<typeof ImportResultResponseSchema>;
