# StudyPulse — Offline-First Smart Study & Live Timed Quiz PWA

**StudyPulse** is a production-grade, bilingual (**Arabic RTL** & **English LTR**) Progressive Web App combining deterministic **FSRS-5 spaced repetition**, **Offline-First IndexedDB syncing**, and **real-time multiplayer timed quiz rooms** powered by Socket.IO.

Designed and built as a full-stack Monorepo (`apps/web`, `apps/api`, `packages/shared`) to demonstrate modern frontend, backend, real-time, and PWA security/performance architecture.

---

## Key Engineering Highlights

* **Deterministic FSRS-5 Across Offline Client & Server:** Shared `ts-fsrs` scheduling engine (`enable_fuzz: false`) inside `packages/shared` with server-side `clampReviewTimestamp` bounds (`+5m / -30d`) to prevent device clock skew from corrupting review schedules.
* **True Offline-First Continuity:**
  * **IndexedDB (Dexie.js):** 5 dedicated tables (`offline_decks`, `offline_cards`, `local_srs_states`, `sync_outbox`, `cached_session_profile`).
  * **Append-Only Idempotent Sync:** Every offline review generates a UUID `idempotencyKey` paired with PostgreSQL `UNIQUE(user_id, idempotency_key)`.
  * **Offline Auth Continuity:** Strictly separates `NETWORK_OFFLINE` (continues offline study via `cached_session_profile`) from real server `HTTP 401` (opens a **non-destructive 401 re-auth modal** without losing unsaved form inputs).
  * **Device Security on Logout:** Explicit logout purges in-memory tokens, `QueryClient`, all 5 IndexedDB tables, and `studypulse-*` runtime caches.
* **Auth Security:** Short-lived HS256 JWT access tokens in memory only + `HttpOnly; SameSite=Strict` rotating refresh tokens tracked by `family_id` with **Token Reuse Detection** (replaying an old refresh token revokes the entire session family immediately).
* **Real-Time Live Timed Quiz Rooms (`Socket.IO`):**
  * Strict server-authoritative State Machine (`LOBBY → COUNTDOWN → QUESTION_ACTIVE → QUESTION_REVEAL → LEADERBOARD → FINISHED`).
  * Server-authoritative countdown timer with client `clockOffsetMs` sync + isolated `<LiveCountdownTimer />` component (turns pulsing Coral in the final 5s without re-rendering quiz choices).
  * **Auto-Distractor MCQ Generator:** Converts any 4+ card deck (`FLASHCARD` or `MCQ`) into 4-choice `A/B/C/D` live questions.
  * **Portfolio Simulated Bots (`0–3`):** Recruiters can test real-time presence, timers, answer distribution bars, and the Top 3 Podium solo in one click.
  * **45s Host Disconnect Grace Window:** Automatic host migration or clean room closure + `room:resync` state reconciliation on socket reconnect.
* **Hybrid `QuestionSourceAdapter`:** Curated bilingual Arabic/English technical packs (works keyless), live **Open Trivia DB** API adapter, and Notes-to-Cards generator (`LLM API` with deterministic `MOCK_LLM` fallback).
* **Focus & Pulse Design System:** Zero-FOUC inline theme & RTL/LTR bootstrapper (`System / Light / Dark`), dynamic `<meta name="theme-color">`, CSS Logical Properties exclusively, 3D Flip flashcards respecting `prefers-reduced-motion`, Violet Retention Contribution Heatmap, and Deferred PWA Update Toast (never interrupts an active timed quiz).

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, TypeScript (Strict), Vite 6, TanStack Router, TanStack Query v5, Zustand, Tailwind CSS, `i18next` (AR RTL / EN LTR), Dexie.js, `vite-plugin-pwa` (Workbox), `socket.io-client` |
| **Backend** | Node.js 22, Fastify 5, Socket.IO 4, PostgreSQL 16 + Prisma ORM (with seeded dev in-memory fallback), Redis 7 room state store, Helmet CSP, Rate Limiting |
| **Shared** | Zod runtime contracts, `ts-fsrs` (FSRS-5), Live Room State Machine rules |
| **Quality & CI** | ESLint 9, Prettier, Vitest, Node Test Runner + `fastify.inject`, GitHub Actions CI, Multi-stage Docker + Nginx |

---

## Quick Start (Local Development)

### 1. Install dependencies
```bash
pnpm install
```

### 2. Optional: Start PostgreSQL & Redis (Docker)
*(If Docker is not running, the API automatically falls back in dev `auto` mode to a pre-seeded in-memory repository so you can test immediately.)*
```bash
docker compose up -d
cp .env.example .env
pnpm prisma:generate
```

### 3. Run API & Web in parallel terminals
```bash
# Terminal 1 — API (http://localhost:4000)
pnpm dev:api

# Terminal 2 — Web PWA (http://localhost:5173)
pnpm dev:web
```

### 4. One-Click Portfolio Demo Walkthrough
1. Open `http://localhost:5173` and click **"Instant Demo Login" / "دخول تجريبي فوري (Demo)"**.
2. Visit **Decks Library (`/decks`)**, pin a deck for offline study, open a deck to import Built-in Bilingual Tech Packs or generate cards from study notes.
3. Click **Start Daily Study Session (`/study`)** to experience Distraction-Free Focus Mode, 3D Flip flashcards (`Space` + `1–4` FSRS-5 shortcuts), and instant IndexedDB outbox syncing.
4. Visit **Analytics (`/analytics`)** to inspect the 91-day Violet Retention Contribution Heatmap and topic recall metrics.
5. Visit **Live Rooms (`/rooms`)**, create a room with **2–3 Simulated Bots**, play through live timed questions, view the **Top 3 Podium**, and click **Add Missed Questions to Review Deck**.
6. Visit **Settings (`/settings`)** to inspect real IndexedDB storage usage, pinned decks, outbox status, Web Push Pre-Prompt, and secure local-data logout wipe.

---

## Verification & Production Deployment

```bash
# Validate schema, build all packages, typecheck, lint, and run unit + API integration tests
pnpm prisma:validate
pnpm build
pnpm typecheck
pnpm lint
pnpm test

# Full production stack with Docker Compose (Web Nginx :8080 + API :4000 + Postgres + Redis)
docker compose -f docker-compose.prod.yml up --build
```
