import type { FastifyInstance } from 'fastify';
import {
  CreateCardInputSchema,
  CreateDeckInputSchema,
  GenerateFromNotesInputSchema,
  ImportQuestionsInputSchema,
  LocaleSchema,
  UpdateCardInputSchema,
  UpdateDeckInputSchema,
} from '@studypulse/shared';
import type { ApiEnv } from '../../config/env.js';
import type { DataRepository } from '../../core/db/repository.js';
import { HttpError } from '../../core/errors/http-error.js';
import { createRequireAuth } from '../auth/auth.middleware.js';
import {
  OPEN_TRIVIA_CATEGORIES,
  generateCardsFromNotes,
  importFromAdapter,
  listBuiltinPacks,
} from '../questions/adapters.js';

export function registerDeckRoutes(
  fastify: FastifyInstance,
  repo: DataRepository,
  env: ApiEnv,
): void {
  const requireAuth = createRequireAuth(env);

  fastify.get('/api/sources/packs', { preHandler: [requireAuth] }, async () => ({
    builtinPacks: listBuiltinPacks(),
    openTriviaCategories: OPEN_TRIVIA_CATEGORIES,
    llmConfigured: Boolean(env.LLM_API_KEY),
  }));

  fastify.get('/api/decks', { preHandler: [requireAuth] }, async (request) => {
    const query = request.query as { search?: string; topic?: string; language?: string };
    const parsedLang = query.language ? LocaleSchema.safeParse(query.language) : null;

    const decks = await repo.listDecks({
      ownerId: request.authUser!.id,
      ...(query.search ? { search: query.search } : {}),
      ...(query.topic ? { topic: query.topic } : {}),
      ...(parsedLang?.success ? { language: parsedLang.data } : {}),
    });

    return { decks };
  });

  fastify.post('/api/decks', { preHandler: [requireAuth] }, async (request, reply) => {
    const input = CreateDeckInputSchema.parse(request.body);
    const deck = await repo.createDeck(request.authUser!.id, input);
    return reply.status(201).send({ deck });
  });

  fastify.get('/api/decks/:deckId', { preHandler: [requireAuth] }, async (request) => {
    const { deckId } = request.params as { deckId: string };
    const deck = await repo.getDeckById(deckId, request.authUser!.id);
    if (!deck) {
      throw new HttpError(404, 'NOT_FOUND', 'Deck not found');
    }
    const cards = await repo.listCardsByDeck(deck.id);
    return { deck, cards };
  });

  fastify.patch('/api/decks/:deckId', { preHandler: [requireAuth] }, async (request) => {
    const { deckId } = request.params as { deckId: string };
    const input = UpdateDeckInputSchema.parse(request.body);
    const deck = await repo.updateDeck(deckId, request.authUser!.id, input);
    if (!deck) {
      throw new HttpError(404, 'NOT_FOUND', 'Deck not found or not owned by user');
    }
    return { deck };
  });

  fastify.delete('/api/decks/:deckId', { preHandler: [requireAuth] }, async (request) => {
    const { deckId } = request.params as { deckId: string };
    const deleted = await repo.deleteDeck(deckId, request.authUser!.id);
    if (!deleted) {
      throw new HttpError(404, 'NOT_FOUND', 'Deck not found or not owned by user');
    }
    return { ok: true };
  });

  fastify.post('/api/decks/:deckId/cards', { preHandler: [requireAuth] }, async (request, reply) => {
    const { deckId } = request.params as { deckId: string };
    const deck = await repo.getDeckById(deckId, request.authUser!.id);
    if (!deck || deck.ownerId !== request.authUser!.id) {
      throw new HttpError(404, 'NOT_FOUND', 'Deck not found or access denied');
    }
    const input = CreateCardInputSchema.parse(request.body);
    const [card] = await repo.createCardsBulk(deckId, [input]);
    return reply.status(201).send({ card });
  });

  fastify.patch('/api/decks/:deckId/cards/:cardId', { preHandler: [requireAuth] }, async (request) => {
    const { deckId, cardId } = request.params as { deckId: string; cardId: string };
    const deck = await repo.getDeckById(deckId, request.authUser!.id);
    if (!deck || deck.ownerId !== request.authUser!.id) {
      throw new HttpError(404, 'NOT_FOUND', 'Deck not found or access denied');
    }
    const input = UpdateCardInputSchema.parse(request.body);
    const card = await repo.updateCard(deckId, cardId, input);
    if (!card) {
      throw new HttpError(404, 'NOT_FOUND', 'Card not found');
    }
    return { card };
  });

  fastify.delete('/api/decks/:deckId/cards/:cardId', { preHandler: [requireAuth] }, async (request) => {
    const { deckId, cardId } = request.params as { deckId: string; cardId: string };
    const deck = await repo.getDeckById(deckId, request.authUser!.id);
    if (!deck || deck.ownerId !== request.authUser!.id) {
      throw new HttpError(404, 'NOT_FOUND', 'Deck not found or access denied');
    }
    const deleted = await repo.deleteCard(deckId, cardId);
    if (!deleted) {
      throw new HttpError(404, 'NOT_FOUND', 'Card not found');
    }
    return { ok: true };
  });

  fastify.post('/api/decks/:deckId/import', { preHandler: [requireAuth] }, async (request, reply) => {
    const { deckId } = request.params as { deckId: string };
    const deck = await repo.getDeckById(deckId, request.authUser!.id);
    if (!deck || deck.ownerId !== request.authUser!.id) {
      throw new HttpError(404, 'NOT_FOUND', 'Deck not found or access denied');
    }
    const input = ImportQuestionsInputSchema.parse(request.body);
    const { source, cards: toCreate } = await importFromAdapter(input);
    const created = await repo.createCardsBulk(deckId, toCreate);
    return reply.status(201).send({
      source,
      importedCount: created.length,
      cards: created,
    });
  });

  fastify.post(
    '/api/decks/:deckId/generate-from-notes',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { deckId } = request.params as { deckId: string };
      const deck = await repo.getDeckById(deckId, request.authUser!.id);
      if (!deck || deck.ownerId !== request.authUser!.id) {
        throw new HttpError(404, 'NOT_FOUND', 'Deck not found or access denied');
      }
      const input = GenerateFromNotesInputSchema.parse(request.body);
      const { source, cards: toCreate } = await generateCardsFromNotes(input, env);
      const created = await repo.createCardsBulk(deckId, toCreate);
      return reply.status(201).send({
        source,
        importedCount: created.length,
        cards: created,
      });
    },
  );
}
