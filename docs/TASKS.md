# Hellenic Bot — Implementation Tasks

## Dependency Graph

```
1 Scaffolding
└── 2 Shared package
    ├── 3 API: DB schema
    │   ├── 4 API: Server + auth + middleware
    │   │   ├── 5 API: User endpoints
    │   │   └── 6 API: Learn endpoints
    │   └── 7 Seed word data
    ├── 8 Bot  (also needs 5 — working /internal/users/upsert)
    └── 9 Webapp: Setup + auth + routing
        ├── 10 Webapp: Home screen
        ├── 11 Webapp: Settings screen
        ├── 12 Webapp: Lesson screen + exercises
        └── 13 Webapp: Lesson Complete screen (also needs 12)

14 Deployment (after all above)
```

### Parallel execution

After Task 2 is done, three lanes can run in parallel:

| Lane A (API)         | Lane B (Bot) | Lane C (Webapp)                    |
|----------------------|--------------|------------------------------------|
| 3 → 4 → 5, 6        | 8            | 9 → 10, 11, 12 (parallel) → 13   |
| 7 (after 3)          |              |                                    |

Task 14 (deployment) — after all lanes complete.

---

## Task 1: Monorepo scaffolding

**Depends on:** —

**Goal:** Set up the project skeleton so all packages can be developed independently.

**Create:**

| File                            | Content                                                                                |
|---------------------------------|----------------------------------------------------------------------------------------|
| `package.json`                  | Root: `"private": true`, scripts (`dev`, `build`, `lint`), devDeps (typescript, turbo)  |
| `pnpm-workspace.yaml`          | `packages: ["packages/*"]`                                                             |
| `turbo.json`                    | Pipeline: `build` (depends on `^build`, outputs `dist/**`), `dev` (persistent, no cache), `db:generate`, `db:migrate` |
| `tsconfig.base.json`           | Strict mode, ESNext target, `moduleResolution: "bundler"`                              |
| `.gitignore`                    | `node_modules`, `dist`, `.env`, `.turbo`, `*.tsbuildinfo`                              |
| `.env.example`                  | All variables from DEPLOY.md § Environment Variables                                   |
| `packages/shared/package.json` | `@hellenic-bot/shared`, main/types pointing to `dist/`                                 |
| `packages/shared/tsconfig.json`| Extends base, `composite: true`                                                       |
| `packages/shared/src/index.ts` | Empty barrel export                                                                    |
| `packages/api/package.json`    | `@hellenic-bot/api`, depends on `@hellenic-bot/shared`                                 |
| `packages/api/tsconfig.json`   | Extends base                                                                           |
| `packages/api/src/index.ts`    | Empty entry                                                                            |
| `packages/bot/package.json`    | `@hellenic-bot/bot`, depends on shared + api (types only)                              |
| `packages/bot/tsconfig.json`   | Extends base                                                                           |
| `packages/bot/src/index.ts`    | Empty entry                                                                            |
| `packages/webapp/package.json` | `@hellenic-bot/webapp`, depends on shared + api (types only)                           |
| `packages/webapp/tsconfig.json`| Extends base                                                                           |

**Dependencies to install:**

| Package    | Dependencies                                                                                |
|------------|---------------------------------------------------------------------------------------------|
| root (dev) | `typescript`, `turbo`, `@types/node`                                                       |
| shared     | `zod`                                                                                       |
| api        | `hono`, `@hono/zod-validator`, `drizzle-orm`, `drizzle-kit`, `postgres`, `jose`            |
| bot        | `grammy`, `hono` (for RPC client type import)                                              |
| webapp     | `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `hono` (for RPC client type import)  |

**Acceptance criteria:**

- `pnpm install` succeeds without errors
- `pnpm build` completes (packages are empty stubs but compile)
- Importing `@hellenic-bot/shared` from `packages/api/src/` resolves types correctly
- TypeScript strict mode is on across all packages

---

## Task 2: Shared package — types, Zod schemas, SRS logic

**Depends on:** Task 1

**Package:** `packages/shared`

**Goal:** Implement all shared types, Zod validation schemas, and SRS logic used by api, bot, and webapp.

### SRS constants and logic (`src/srs.ts`)

- SRS stage type: `'new' | 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4' | 'learned'`
- Stage order array (for arithmetic): `['new', 'stage_1', 'stage_2', 'stage_3', 'stage_4', 'learned']`
- Stage intervals map (minutes, applied on advance):

  | From      | To        | Interval (min) |
  |-----------|-----------|----------------|
  | new       | stage_1   | 0              |
  | stage_1   | stage_2   | 0              |
  | stage_2   | stage_3   | 1440           |
  | stage_3   | stage_4   | 1440           |
  | stage_4   | learned   | 1440           |
  | learned   | learned   | 1440           |

- Progression function:

  ```
  computeProgression(currentStage, errorCount) → { newStage, intervalMinutes }
  ```

  | Errors | Action                                   | intervalMinutes           |
  |--------|------------------------------------------|---------------------------|
  | 0      | Advance to next stage (+1)               | From interval table above |
  | 1      | Stay at current stage                    | 0                         |
  | >1     | Roll back one stage (min: `new`)         | 0                         |

  `intervalMinutes = 0` means `next_review_at = now()` (word immediately available).

  Reference: CORE.md § SRS Algorithm.

### Exercise types (`src/exercises.ts`)

- Exercise type: `'flashcard' | 'multiple_choice' | 'multiple_choice_reverse' | 'fill_blank' | 'scramble'`
- Exercises-per-stage map:

  | Stage   | Exercises (in order)                             |
  |---------|--------------------------------------------------|
  | new     | flashcard, multiple_choice                       |
  | stage_1 | multiple_choice, multiple_choice_reverse          |
  | stage_2 | multiple_choice, multiple_choice_reverse, fill_blank |
  | stage_3 | scramble, fill_blank                             |
  | stage_4 | scramble, fill_blank                             |
  | learned | scramble, fill_blank                             |

  The order in each row matters — it defines per-word exercise ordering within a lesson.

  Reference: CORE.md § Exercises per Stage.

### Zod schemas (`src/schemas.ts`)

All API request/response validation schemas as defined in API.md. Types inferred via `z.infer<>`.

**Schemas to define:**

| Schema name                  | Used for                          | Key fields                                                                                    |
|------------------------------|-----------------------------------|-----------------------------------------------------------------------------------------------|
| `UserSchema`                 | User object in all responses      | `id`, `telegram_id`, `first_name`, `last_name?`, `username?`, `display_language`, `words_per_lesson` |
| `AuthValidateRequestSchema`  | `POST /auth/validate` body        | `init_data: string`                                                                           |
| `AuthValidateResponseSchema` | `POST /auth/validate` response    | `token: string`, `user: UserSchema`                                                           |
| `UpsertUserRequestSchema`    | `POST /internal/users/upsert` body| `telegram_id: number`, `first_name: string`, `last_name?: string`, `username?: string`, `language_code?: string` |
| `UpdateSettingsRequestSchema`| `PATCH /users/me/settings` body   | `display_language?: 'en'\|'ru'`, `words_per_lesson?: int 1–20`; at least one field required   |
| `LearnStatsResponseSchema`   | `GET /learn/stats` response       | `new_available`, `continue_available`, `review_available`, `total_words`, `learned_words`      |
| `StartLessonRequestSchema`   | `POST /learn/lesson` body         | `mode: 'new'\|'continue'\|'review'`                                                          |
| `ExerciseSchema`             | Discriminated union by type       | See below                                                                                     |
| `StartLessonResponseSchema`  | `POST /learn/lesson` response     | `exercises: ExerciseSchema[]`                                                                 |
| `ExerciseResultSchema`       | Single result in complete request | `word_id`, `exercise_type`, `is_correct`, `answer_given: string\|null`, `time_spent_ms?: int` |
| `CompleteLessonRequestSchema`| `POST /learn/complete` body       | `results: ExerciseResultSchema[]` (non-empty)                                                 |
| `CompleteLessonResponseSchema`| `POST /learn/complete` response  | `words: WordResultSchema[]`, `summary: SummarySchema`                                         |
| `ErrorResponseSchema`        | All error responses               | `error: { code: string, message: string }`                                                    |

**Exercise schema — discriminated union by `exercise_type`:**

| Type                     | Fields                                                                                             |
|--------------------------|----------------------------------------------------------------------------------------------------|
| flashcard                | `word_id`, `exercise_type`, `prompt: { original, transcription? }`, `answer: { translation }`     |
| multiple_choice          | `word_id`, `exercise_type`, `prompt: { original, transcription? }`, `options: string[]`, `correct_index: 0` |
| multiple_choice_reverse  | `word_id`, `exercise_type`, `prompt: { translation }`, `options: { original, transcription? }[]`, `correct_index: 0` |
| fill_blank               | `word_id`, `exercise_type`, `prompt: { translation }`, `answer: { original }`                     |
| scramble                 | `word_id`, `exercise_type`, `prompt: { translation, scrambled: string[][] }`, `answer: { original }` |

Reference: API.md § POST /learn/lesson (full response examples and field descriptions).

### Barrel export (`src/index.ts`)

Re-export everything from `srs.ts`, `exercises.ts`, `schemas.ts`.

### Acceptance criteria

- All types and schemas compile with strict TypeScript
- `computeProgression` returns correct results:

  | Input                  | Expected output                            |
  |------------------------|--------------------------------------------|
  | `('new', 0)`           | `{ newStage: 'stage_1', interval: 0 }`    |
  | `('stage_2', 1)`       | `{ newStage: 'stage_2', interval: 0 }`    |
  | `('stage_1', 2)`       | `{ newStage: 'new', interval: 0 }`        |
  | `('new', 3)`           | `{ newStage: 'new', interval: 0 }`        |
  | `('stage_4', 0)`       | `{ newStage: 'learned', interval: 1440 }` |
  | `('learned', 1)`       | `{ newStage: 'learned', interval: 0 }`    |
  | `('learned', 2)`       | `{ newStage: 'stage_4', interval: 0 }`    |

- Exercises-per-stage returns correct exercise lists for each stage
- Zod schemas validate correct payloads and reject invalid ones

---

## Task 3: API — Drizzle schema & migrations

**Depends on:** Task 2

**Package:** `packages/api`

**Goal:** Define the database schema in Drizzle ORM and generate the initial migration.

### Schema (`src/db/schema.ts`)

All tables exactly as in CORE.md § Tables:

**Enum:**
- `srs_stage`: `new`, `stage_1`, `stage_2`, `stage_3`, `stage_4`, `learned`

**Tables:**

| Table            | Key columns and constraints                                                               |
|------------------|-------------------------------------------------------------------------------------------|
| `users`          | `id` serial PK, `telegram_id` bigint UNIQUE NOT NULL, `first_name` varchar(255) NOT NULL, `last_name` varchar(255), `username` varchar(255), `language_code` varchar(10), `display_language` varchar(10) NOT NULL DEFAULT 'en', `words_per_lesson` integer NOT NULL DEFAULT 5, `created_at` timestamptz DEFAULT now(), `updated_at` timestamptz DEFAULT now() |
| `words`          | `id` serial PK, `original` varchar(255) UNIQUE NOT NULL, `transcription` varchar(255), `translations` jsonb NOT NULL, `created_at` timestamptz DEFAULT now() |
| `user_progress`  | `id` serial PK, `user_id` FK→users NOT NULL, `word_id` FK→words NOT NULL, `srs_stage` srs_stage NOT NULL DEFAULT 'new', `next_review_at` timestamptz NOT NULL DEFAULT now(), `last_reviewed_at` timestamptz, `created_at` timestamptz DEFAULT now() |
| `exercise_results` | `id` serial PK, `user_id` FK→users NOT NULL, `word_id` FK→words NOT NULL, `exercise_type` varchar(50) NOT NULL, `is_correct` boolean NOT NULL, `answer_given` varchar(500), `time_spent_ms` integer, `created_at` timestamptz DEFAULT now() |

**Indexes:**

| Index                          | Columns                                    | Type   |
|--------------------------------|--------------------------------------------|--------|
| `user_progress_user_word_idx`  | `(user_id, word_id)`                       | UNIQUE |
| `user_progress_review_idx`     | `(user_id, srs_stage, next_review_at)`     | INDEX  |
| `exercise_results_user_id_idx` | `(user_id, created_at)`                    | INDEX  |
| `exercise_results_word_id_idx` | `(word_id)`                                | INDEX  |

**Cascade rules:**

| Parent | Child            | On Delete |
|--------|------------------|-----------|
| users  | user_progress    | CASCADE   |
| users  | exercise_results | CASCADE   |
| words  | user_progress    | CASCADE   |
| words  | exercise_results | CASCADE   |

**Relations:** define Drizzle relations for type-safe joins.

Reference: CORE.md § Tables, § Cascade Rules.

### DB connection (`src/db/index.ts`)

- Connect using `postgres` driver
- Read `DATABASE_URL` from environment
- Export `db` instance

### Drizzle config (`drizzle.config.ts`)

- Schema path: `src/db/schema.ts`
- Migrations output: `drizzle/`
- Dialect: `postgresql`
- `DATABASE_URL` from env

### Scripts in `package.json`

| Script        | Command                  |
|---------------|--------------------------|
| `db:generate` | `drizzle-kit generate`   |
| `db:migrate`  | `drizzle-kit migrate`    |
| `db:studio`   | `drizzle-kit studio`     |

### Acceptance criteria

- `pnpm --filter api db:generate` produces a migration file in `packages/api/drizzle/`
- `pnpm --filter api db:migrate` applies it to a running PostgreSQL instance
- All tables, enum, indexes, and constraints exist in the DB
- FK cascades work: deleting a user removes their progress and exercise results

---

## Task 4: API — Hono server, middleware, auth

**Depends on:** Task 2, Task 3

**Package:** `packages/api`

**Goal:** Set up the Hono HTTP server with error handling, JWT authentication, and the `POST /auth/validate` endpoint.

### Server entry (`src/index.ts`)

- Create Hono app
- Run Drizzle migrations on startup (before listening)
- Listen on `PORT` env var (default 3000)
- Export `AppType` for Hono RPC (used by bot and webapp as type-only import)

### Error handler middleware (`src/middleware/error.ts`)

Catch unhandled errors, return the standard error format:

```json
{ "error": { "code": "INTERNAL_ERROR", "message": "..." } }
```

Log full error details server-side. Never leak stack traces to the client.

Reference: API.md § Error Format.

### Auth middleware (`src/middleware/auth.ts`)

- **Skip** for: `GET /health`, `POST /auth/validate`, all `/internal/*` routes
- Read `Authorization: Bearer <token>` header
- Validate JWT using `jose` library, secret = `BOT_TOKEN` env var
- Extract `sub` (user id) and `tid` (telegram_id) from payload
- Set user context: `c.set('userId', sub)`
- On failure: return `401 { error: { code: "UNAUTHORIZED", message: "..." } }`

Reference: API.md § Authentication.

### JWT payload format

```json
{
  "sub": 1,
  "tid": 123456789,
  "iat": 1700000000,
  "exp": 1700086400
}
```

TTL: 24 hours (86400 seconds). Signed with `BOT_TOKEN`.

### `GET /health`

No auth. Return `200 { "status": "ok" }`.

### `POST /auth/validate`

No auth (this endpoint issues tokens).

1. Validate request body with Zod: `{ init_data: string }`
2. Validate Telegram initData signature (HMAC-SHA256 — algorithm below)
3. Parse `user` object from initData
4. Upsert user in DB (same logic as `/internal/users/upsert` — reuse the function from Task 5, or implement here and share)
5. Generate JWT
6. Return `{ token, user }` (user shape: `UserSchema`)

**initData validation algorithm** (Telegram standard — see API.md § initData Validation Algorithm):

1. Parse `init_data` as URL search params
2. Extract and remove `hash` param
3. Sort remaining params alphabetically by key
4. Join as `key=value\n` (newline-separated, no trailing newline)
5. Compute HMAC-SHA256 of the bot token using the literal string `"WebAppData"` as the HMAC key → `secret_key`
6. Compute HMAC-SHA256 of the data check string (step 4) using `secret_key` → `computed_hash`
7. Compare `computed_hash` (hex) to the extracted `hash` value

**Errors:**
- `400 VALIDATION_ERROR` — missing or malformed `init_data`
- `401 UNAUTHORIZED` — invalid or expired initData

Reference: API.md § POST /auth/validate, § JWT Payload.

### Acceptance criteria

- `GET /health` returns `200 { "status": "ok" }`
- `POST /auth/validate` with valid initData returns JWT + user object
- `POST /auth/validate` with invalid initData returns 401
- Authenticated requests with valid JWT reach route handlers
- Requests without JWT to protected endpoints return 401
- Requests to `/internal/*` bypass JWT auth
- `AppType` is exported and importable by bot/webapp (type-only)

---

## Task 5: API — User endpoints

**Depends on:** Task 4

**Package:** `packages/api`

**Goal:** Implement user management endpoints.

### `POST /internal/users/upsert`

No JWT auth (internal, blocked by nginx in production).

- Validate body: `UpsertUserRequestSchema` from shared
- Upsert by `telegram_id` (Drizzle `onConflictDoUpdate`):
  - **Existing user:** update `first_name`, `last_name`, `username`, `language_code`, `updated_at`
  - **New user:** create with:
    - `display_language` = `language_code` if it's `'en'` or `'ru'`, otherwise `'en'`
    - `words_per_lesson` = 5
- Return user object (`UserSchema`)

Reference: API.md § POST /internal/users/upsert.

### `GET /users/me`

JWT required. Read `userId` from auth context.

- Fetch user by `id`
- Return user object (`UserSchema`)
- If not found: return `404 NOT_FOUND` (should not happen with valid JWT)

### `PATCH /users/me/settings`

JWT required. Read `userId` from auth context.

- Validate body: `UpdateSettingsRequestSchema` from shared
  - `display_language`: one of `'en'`, `'ru'` (optional)
  - `words_per_lesson`: integer 1–20 (optional)
  - At least one field must be provided
- Update only provided fields + `updated_at`
- Return updated user object (`UserSchema`)
- On invalid values: return `400 VALIDATION_ERROR`

Reference: API.md § GET /users/me, § PATCH /users/me/settings.

### Acceptance criteria

- Upsert creates new user with correct defaults
- Upsert updates existing user's profile fields, does not change `display_language` or `words_per_lesson`
- `display_language` derivation on create: `language_code = 'ru'` → `'ru'`; `language_code = 'el'` → `'en'`
- Settings validation rejects `words_per_lesson: 0`, `words_per_lesson: 21`, `display_language: 'de'`
- Settings update is partial (providing only `words_per_lesson` does not change `display_language`)
- `GET /users/me` returns the current user profile

---

## Task 6: API — Learn endpoints

**Depends on:** Task 4

**Package:** `packages/api`

**Goal:** Implement the core learning endpoints: stats, lesson generation, and lesson completion.

### `GET /learn/stats`

Returns home screen data. Query as in CORE.md § Key Queries — "Check available learning modes" + "Get user's overall progress."

Response: `LearnStatsResponseSchema` from shared.

```json
{
  "new_available": 42,
  "continue_available": 5,
  "review_available": 3,
  "total_words": 100,
  "learned_words": 30
}
```

### `POST /learn/lesson`

Selects words and generates exercises.

**Step 1 — Word selection:**

| Mode       | Query (see CORE.md § Key Queries)                                        |
|------------|--------------------------------------------------------------------------|
| `new`      | Words with no `user_progress` record for this user                       |
| `continue` | `srs_stage != 'learned'` AND `next_review_at <= now()`                  |
| `review`   | `srs_stage = 'learned'` AND `next_review_at <= now()`                    |

Each query: `ORDER BY random() LIMIT user.words_per_lesson`.

If 0 words found → return `400 NO_WORDS`.

**Step 2 — Exercise generation (per word):**

1. Determine `srs_stage`:
   - Mode `new` → stage = `new`
   - Mode `continue` / `review` → stage from `user_progress` query result
2. Look up exercises for this stage from the exercises-per-stage map (shared package)
3. Generate each exercise object:

   | Exercise type           | Generation                                                                                          |
   |-------------------------|-----------------------------------------------------------------------------------------------------|
   | flashcard               | `{ word_id, exercise_type, prompt: { original, transcription }, answer: { translation } }`         |
   | multiple_choice         | Pick 3 random distractors (different words, same `display_language`). `options: [correct, d1, d2, d3]`, `correct_index: 0` |
   | multiple_choice_reverse | Pick 3 random distractors as `{ original, transcription }`. `options: [correct, d1, d2, d3]`, `correct_index: 0` |
   | fill_blank              | `{ word_id, exercise_type, prompt: { translation }, answer: { original } }`                        |
   | scramble                | Split `original` by spaces. Shuffle characters within each group. `prompt: { translation, scrambled: string[][] }`, `answer: { original }` |

   **Translation resolution:** use `words.translations[display_language]`, fallback to `words.translations['en']`.

   **Distractor selection for multiple choice:**
   - Select 3 random words from `words` table where `id != current_word_id`
   - Use the same `display_language` for distractor translations (with `en` fallback)
   - The system requires at least 4 words total (CORE.md § Word Management)

**Step 3 — Exercise ordering (interleave with per-word constraints):**

The exercises must be interleaved across words but maintain per-word relative order (flashcard → middle types → fill_blank). Algorithm:

1. For each word, its exercises have a natural index (0, 1, 2, ...) from the per-stage list
2. Process in rounds: round 0 = all exercises with index 0 from every word (shuffled), then round 1, etc.
3. Concatenate rounds

Example with 3 words at `stage_2` (exercises per word: mc, mc_rev, fill):
```
Round 0: [A-mc, B-mc, C-mc]         → shuffle → [C-mc, A-mc, B-mc]
Round 1: [A-mc_rev, B-mc_rev, C-mc_rev] → shuffle → [B-mc_rev, A-mc_rev, C-mc_rev]
Round 2: [A-fill, B-fill, C-fill]    → shuffle → [A-fill, C-fill, B-fill]
Final:   [C-mc, A-mc, B-mc, B-mc_rev, A-mc_rev, C-mc_rev, A-fill, C-fill, B-fill]
```

Per-word order preserved: A(mc→mc_rev→fill), B(mc→mc_rev→fill), C(mc→mc_rev→fill).

Reference: LESSON.md § Ordering.

**Return:** `StartLessonResponseSchema` — `{ exercises: [...] }`.

### `POST /learn/complete`

Submit lesson results. All operations in a **single DB transaction**.

**Input:** `CompleteLessonRequestSchema` from shared.

**Processing steps:**

1. **Insert** all results into `exercise_results` table
2. **Group** results by `word_id`
3. **For each word:**
   a. Count errors: number of results where `is_correct === false` (flashcard is always `true`, no special handling)
   b. Fetch current `user_progress` record (may not exist for first-encounter words)
   c. Determine `previous_stage`: existing `srs_stage` or `null` if no record
   d. Compute progression: `computeProgression(currentStage, errorCount)` from shared (treat no-record as `'new'`)
   e. Compute `next_review_at`: `now() + intervalMinutes * 60 * 1000` (if interval > 0) or `now()` (if interval = 0)
   f. Upsert `user_progress`:
      - No existing record → INSERT with `srs_stage = newStage`, `next_review_at`, `last_reviewed_at = now()`
      - Existing record → UPDATE `srs_stage`, `next_review_at`, `last_reviewed_at`
4. **Build response:**

   ```json
   {
     "words": [
       { "word_id": 42, "original": "γεια", "errors": 0, "previous_stage": null, "new_stage": "stage_1" }
     ],
     "summary": {
       "total_exercises": 6,
       "correct": 4,
       "incorrect": 2,
       "words_advanced": 2,
       "words_stayed": 0,
       "words_rolled_back": 1
     }
   }
   ```

   - `previous_stage: null` for first-encounter words (no prior `user_progress`)
   - `words_advanced` = words with 0 errors
   - `words_stayed` = words with exactly 1 error
   - `words_rolled_back` = words with >1 errors

Reference: API.md § POST /learn/complete, CORE.md § Stage Progression, § SRS Algorithm.

### Acceptance criteria

- `GET /learn/stats` returns correct counts for all three modes + totals
- `POST /learn/lesson` with mode `new` returns only flashcard + multiple_choice exercises
- `POST /learn/lesson` with mixed stages returns correct exercise types per word
- Multiple choice exercises have exactly 4 options with correct at index 0
- Scramble for multi-word phrases returns `string[][]` with characters shuffled per word group
- Exercise ordering preserves per-word relative order while interleaving across words
- `POST /learn/complete` inserts `exercise_results` records
- `POST /learn/complete` updates `user_progress` correctly:
  - 0 errors → advance stage, `next_review_at` per interval
  - 1 error → stay, `next_review_at = now()`
  - >1 errors → roll back (min `new`), `next_review_at = now()`
- First-encounter words: `user_progress` created, `previous_stage: null` in response
- Transaction: if any step fails, nothing is committed

---

## Task 7: Seed word data

**Depends on:** Task 3

**Package:** `packages/api`

**Goal:** Create a SQL migration with an initial set of Greek words for testing.

### Migration file

Create `packages/api/drizzle/NNNN_seed_words.sql` (next sequential number after existing migrations).

Include at least 10 common Greek words with both `en` and `ru` translations:

```sql
INSERT INTO words (original, transcription, translations) VALUES
  ('γεια', 'yia', '{"en": "hello", "ru": "привет"}'),
  ('ευχαριστώ', 'efcharistó', '{"en": "thank you", "ru": "спасибо"}'),
  ('νερό', 'neró', '{"en": "water", "ru": "вода"}'),
  ('ψωμί', 'psomí', '{"en": "bread", "ru": "хлеб"}'),
  ('καλημέρα', 'kaliméra', '{"en": "good morning", "ru": "доброе утро"}'),
  ('αντίο', 'adío', '{"en": "goodbye", "ru": "до свидания"}'),
  ('παρακαλώ', 'parakaló', '{"en": "please / you''re welcome", "ru": "пожалуйста"}'),
  ('ναι', 'ne', '{"en": "yes", "ru": "да"}'),
  ('όχι', 'óchi', '{"en": "no", "ru": "нет"}'),
  ('καλησπέρα', 'kalispéra', '{"en": "good evening", "ru": "добрый вечер"}'),
  ('καληνύχτα', 'kaliníchta', '{"en": "good night", "ru": "спокойной ночи"}'),
  ('καλημέρα σας', 'kaliméra sas', '{"en": "good morning (formal)", "ru": "доброе утро (формальное)"}')
ON CONFLICT (original) DO NOTHING;
```

### Requirements

- Every word must have an `en` key in translations (required fallback)
- `ON CONFLICT DO NOTHING` for idempotency (migration can be re-run safely)
- At least one multi-word phrase (`καλημέρα σας`) to test scramble with fixed spaces
- At least 10 words total (4 minimum for multiple choice distractors, more for realistic testing)

Reference: CORE.md § Word Management.

### Acceptance criteria

- Migration applies cleanly on a fresh DB (after schema migration)
- Running the migration twice does not create duplicates
- At least 10 words with `en` + `ru` translations
- At least one multi-word phrase

---

## Task 8: Bot — Telegram bot

**Depends on:** Task 2, Task 5

**Package:** `packages/bot`

**Goal:** Implement the Telegram bot with grammY.

### Bot setup (`src/index.ts`)

- Create grammY bot instance with `BOT_TOKEN` env var
- Register handlers (order matters: `/start` first, then fallback catch-all)
- Start long polling
- Graceful shutdown on SIGINT/SIGTERM

### API client (`src/api.ts`)

Hono RPC typed client:

```typescript
import { hc } from "hono/client";
import type { AppType } from "@hellenic-bot/api";

const client = hc<AppType>(process.env.API_URL!);
```

`API_URL` = `http://api:3000` in production (from docker-compose), `http://localhost:3000` for local dev.

### `/start` handler (`src/handlers/start.ts`)

1. Extract user data from `ctx.from`: `telegram_id`, `first_name`, `last_name`, `username`, `language_code`
2. Call `POST /internal/users/upsert` via RPC client
3. Use returned `display_language` to pick welcome message language
4. Send welcome message + inline keyboard with web_app button

**Welcome messages** (from BOT.md):

| Language | Message                                                                                           |
|----------|---------------------------------------------------------------------------------------------------|
| en       | `Hi, {first_name}! 👋\n\nLearn Greek vocabulary with spaced repetition.\n\nTap the button below to get started.` |
| ru       | `Привет, {first_name}! 👋\n\nУчи греческие слова с помощью интервального повторения.\n\nНажми кнопку ниже, чтобы начать.` |

**Inline keyboard:** single button `"🎓 Open App"` / `"🎓 Открыть"` (by language), type `web_app`, URL from `WEBAPP_URL` env var.

**Error handling:** if API call fails:
1. Log the error
2. Fall back to `ctx.from.language_code` for message language (`'ru'` if `language_code === 'ru'`, `'en'` otherwise)
3. Still send welcome message + button

Reference: BOT.md § /start Flow, § Welcome Message, § Error Handling.

### Unrecognized input handler (`src/handlers/fallback.ts`)

- `bot.on('message')` — catch-all for everything except `/start`
- Language from `ctx.from.language_code`: `'ru'` if Russian, `'en'` otherwise
- Reply with redirect message (no API call):

| Language | Message                                                    |
|----------|------------------------------------------------------------|
| en       | `Use the app to learn. Tap /start to open it.`            |
| ru       | `Используй приложение для обучения. Нажми /start, чтобы открыть.` |

Reference: BOT.md § Unrecognized Input.

### Acceptance criteria

- Bot starts with long polling, connects to Telegram
- `/start` sends welcome message with correct language
- Inline keyboard button opens Mini App URL
- API failure on `/start` falls back gracefully (uses Telegram language_code, still sends message + button)
- Unrecognized messages get fallback reply
- SIGINT/SIGTERM triggers graceful shutdown

---

## Task 9: Webapp — Setup, auth, routing, i18n

**Depends on:** Task 2

**Package:** `packages/webapp`

**Goal:** Set up the webapp shell: React + Vite, authentication, screen routing, i18n, Telegram SDK integration, and reusable UI primitives.

### Vite config

- React plugin
- Dev proxy: `/api` → `http://localhost:3000` with `/api` prefix stripped (see DEPLOY.md § Environment Variables):

  ```typescript
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  }
  ```

### CSS / theming

Use Telegram theme CSS variables exclusively — no custom color palette:

| Variable                        | Usage          |
|---------------------------------|----------------|
| `--tg-theme-bg-color`          | Background     |
| `--tg-theme-text-color`        | Text           |
| `--tg-theme-button-color`      | Primary buttons|
| `--tg-theme-button-text-color` | Button text    |

Reference: WEBAPP.md § Theme.

### Auth flow

1. On app mount: read `window.Telegram.WebApp.initData`
2. Send `POST /api/auth/validate { init_data: initData }`
3. Store JWT **in memory** (not localStorage — session-scoped)
4. All subsequent requests attach `Authorization: Bearer <token>`
5. If auth fails: full-screen error overlay
6. If any subsequent request returns 401: show "Session expired. Please reopen the app." overlay

Reference: WEBAPP.md § Authentication.

### API client (`src/api.ts`)

Hono RPC typed client with auth header injection:

```typescript
import { hc } from "hono/client";
import type { AppType } from "@hellenic-bot/api";

// Custom fetch that injects Authorization header
const client = hc<AppType>(import.meta.env.VITE_API_URL, {
  fetch: (input, init) => {
    return fetch(input, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    });
  },
});
```

### Routing

4 screens: **Home**, **Settings**, **Lesson**, **LessonComplete**.

Simple state-based routing is sufficient (no react-router needed for 4 screens). A state variable or context determines which screen is visible, plus any props (e.g., lesson mode, completion results).

### Telegram SDK integration (`src/telegram.ts`)

| Feature         | Usage                                                         |
|-----------------|---------------------------------------------------------------|
| `expand()`      | Call on load to use full screen height                        |
| `BackButton`    | Show on Settings, Lesson, LessonComplete. Hide on Home       |
| `HapticFeedback`| `impactOccurred('light')` on tap, `notificationOccurred('success'/'error')` on answer |

Reference: WEBAPP.md § Back Button, § Haptic Feedback, § Viewport.

Type declarations: either use `@telegram-apps/sdk-react` package or declare `window.Telegram` types manually.

### i18n (`src/i18n.ts`)

Simple translation object keyed by language code:

```typescript
const translations = {
  en: {
    learnNew: "Learn New",
    continue: "Continue",
    review: "Review",
    // ... all UI strings
  },
  ru: {
    learnNew: "Новые слова",
    continue: "Продолжить",
    review: "Повторение",
    // ...
  },
};
```

- Current language from user profile (`display_language`)
- Re-render on language change (triggered from Settings)
- All user-facing strings must have both `en` and `ru` variants

**Strings needed for:** Home screen labels, Settings labels, Lesson UI (all exercise types), Lesson Complete, error messages, loading states, confirmation dialogs.

### Reusable UI components

| Component       | Usage                                                          |
|-----------------|----------------------------------------------------------------|
| FullScreenSpinner | Auth loading, lesson loading                                |
| ErrorOverlay    | Network error, API error, session expired (message + retry)   |
| Skeleton        | Home screen loading placeholder                                |
| Toast           | Non-blocking error (e.g., settings save failure)               |

Reference: WEBAPP.md § Loading & Error States.

### Acceptance criteria

- Vite dev server starts with HMR
- Auth flow: initData → JWT → authenticated API calls work
- Navigation between all 4 screens works
- Telegram BackButton shows/hides per screen rules
- Haptic feedback functions callable
- UI uses Telegram theme colors
- All strings available in en and ru
- Full-screen spinner during auth
- Error overlay on auth failure

---

## Task 10: Webapp — Home screen

**Depends on:** Task 9

**Package:** `packages/webapp`

**Goal:** Implement the Home screen.

### Data

Fetch `GET /api/learn/stats` on mount and on return from Settings or Lesson Complete.

### Layout (see WEBAPP.md § Home)

```
┌─────────────────────────────┐
│ 🇬🇷 Hellenic          ⚙️    │  ← Settings gear
├─────────────────────────────┤
│   42 / 100 words learned    │  ← learned_words / total_words
│   ████████░░░░░░░  42%      │  ← Progress bar
├─────────────────────────────┤
│  [ 📗 Learn New  (15) ]    │  ← new_available
│  [ 📙 Continue    (5) ]    │  ← continue_available
│  [ 📘 Review      (3) ]    │  ← review_available
└─────────────────────────────┘
```

### Behavior

| Element         | Action                                              |
|-----------------|-----------------------------------------------------|
| Mode button     | Navigate to Lesson screen with `mode` param         |
| Disabled button | Count = 0 → visually muted, not clickable           |
| All counts = 0  | Show "All caught up! Come back later." instead of buttons |
| Settings gear   | Navigate to Settings screen                         |

### States

| State   | Display                                           |
|---------|---------------------------------------------------|
| Loading | Skeleton placeholders for progress bar and buttons |
| Error   | Error overlay with retry button                    |
| Empty   | "All caught up" message                            |

### Acceptance criteria

- Stats fetched and displayed correctly
- Mode buttons show correct counts
- Disabled buttons when count = 0
- "All caught up" state when all counts = 0
- Settings gear navigates to Settings
- Mode button navigates to Lesson with correct mode
- Stats refetch on return from Settings or Lesson Complete
- Loading skeleton while fetching

---

## Task 11: Webapp — Settings screen

**Depends on:** Task 9

**Package:** `packages/webapp`

**Goal:** Implement the Settings screen.

### Layout (see WEBAPP.md § Settings)

```
┌─────────────────────────────┐
│ ← Settings                  │  ← Telegram BackButton
├─────────────────────────────┤
│  Words per lesson           │
│  ◀  5  ▶                    │  ← Stepper, range 1–20
│                             │
│  Language                   │
│  [ EN ] [ RU ]              │  ← Toggle, selected = filled
└─────────────────────────────┘
```

### Behavior

- **Words per lesson stepper:** ◀ / ▶ buttons, range 1–20. Disable ◀ at 1, ▶ at 20.
- **Language toggle:** EN / RU. Selected option visually distinct (filled/highlighted).
- **Save:** each change immediately sends `PATCH /api/users/me/settings` with the changed field only.
- **On API success:** update local state.
- **On API failure:** revert control to previous value, show toast "Failed to save. Try again."
- **Language change:** immediately updates all visible UI strings (triggers i18n context update).
- **Back:** Telegram BackButton → navigate to Home. Home must refetch stats (since `words_per_lesson` or `display_language` may have changed).

Reference: WEBAPP.md § Settings, API.md § PATCH /users/me/settings.

### Acceptance criteria

- Stepper increments/decrements within 1–20
- Cannot go below 1 or above 20
- Language toggle switches between EN and RU
- Each change sends PATCH request immediately
- On API error: control reverts to previous value, toast shown
- Language change updates all visible UI text
- Back returns to Home with refreshed stats

---

## Task 12: Webapp — Lesson screen + exercise components

**Depends on:** Task 9

**Package:** `packages/webapp`

**Goal:** Implement the Lesson screen and all 5 exercise type components.

### Lesson screen (`src/screens/Lesson.tsx`)

- Receives `mode` from navigation
- On mount: `POST /api/learn/lesson { mode }` → get exercises
- Loading: full-screen spinner "Preparing lesson..."
- Display exercises one at a time
- **Progress:** `{current} / {total}` counter + progress bar
- **Close (✕):** confirmation dialog → if confirmed, navigate Home (all results lost, nothing sent to server)
- **Telegram BackButton:** same as ✕ (show confirmation)
- **Result tracking:** accumulate `{ word_id, exercise_type, is_correct, answer_given, time_spent_ms }[]` in state
- **Timer:** start per-exercise timer when exercise appears, stop on answer → `time_spent_ms`
- **After last exercise:** send `POST /api/learn/complete { results }`, show spinner during submission, then navigate to Lesson Complete with response data

### Exercise components

Each component receives its exercise data and calls `onComplete(result)` callback when the user finishes.

#### Flashcard

```
┌────────────────────┐          ┌────────────────────┐
│       γεια         │  bold    │       γεια         │
│       yia          │  muted   │       yia          │
│                    │          │      hello         │
│   [ Tap to reveal ]│          │   [ Continue → ]   │
└────────────────────┘          └────────────────────┘
```

- Tap to reveal translation
- "Continue" → `onComplete({ is_correct: true, answer_given: null })`
- Haptic: `impactOccurred('light')` on tap

#### Multiple Choice

- Show `original` (bold, large) + `transcription` (muted, small)
- 4 option buttons with translations
- **Client must shuffle options** (API returns correct at index 0). Track correct position after shuffle.
- On tap: highlight correct (green) + wrong if selected (red), auto-advance after ~1s
- `answer_given` = selected option text
- Haptic: `notificationOccurred('success')` or `notificationOccurred('error')`

#### Multiple Choice Reverse

- Show `translation` as prompt
- 4 option buttons with `original` (bold) + `transcription` (muted) each
- Same shuffle + interaction as Multiple Choice
- `answer_given` = selected `original` text

#### Fill Blank

- Show `translation` as prompt
- Text input field (should suggest Greek keyboard on mobile)
- "Check" button
- **Comparison:** trim whitespace, lowercase both sides, compare. Accents must match exactly. (Reference: LESSON.md § Fill Blank)
- If wrong: show correct answer — `original` bold + `transcription` muted
- `answer_given` = raw user input (before normalization)
- Auto-advance after showing result
- Haptic feedback on result

#### Scramble

- Show `translation` as prompt
- **For each word group** in `scrambled` (`string[][]`):
  - Row of empty slots (count = group character count)
  - Available letter tiles below
- Groups separated by fixed space indicator
- Tap available letter → place in next empty slot of that group
- Tap placed letter → remove, return to available
- "Check" button (enabled when all slots filled)
- Compare: concatenate groups with spaces, exact match against `answer.original`
- `answer_given` = assembled string
- If wrong: show correct answer
- Haptic feedback on result

**Typography rule** (all exercises): Greek word = bold/large, transcription = muted/small below it.

Reference: WEBAPP.md § Exercise Types — UI, LESSON.md § Answer Comparison Rules.

### Acceptance criteria

- All 5 exercise types render and function correctly
- Flashcard always counts as correct
- Multiple choice options are shuffled (correct is NOT always at position 0 in UI)
- Fill blank: case-insensitive, trimmed, accents must match
- Scramble: tap to place/remove letters, multi-word shows separate groups with fixed spaces
- Progress bar and counter update after each exercise
- Close button shows confirmation before abandoning
- Results accumulated correctly in state
- `time_spent_ms` tracked per exercise
- After last exercise: results submitted, Lesson Complete shown
- Spinner during result submission

---

## Task 13: Webapp — Lesson Complete screen

**Depends on:** Task 12

**Package:** `packages/webapp`

**Goal:** Implement the Lesson Complete screen.

### Data

Response from `POST /api/learn/complete` — passed from Lesson screen after submission.

### Layout (see WEBAPP.md § Lesson Complete)

```
┌─────────────────────────────┐
│        Lesson Complete      │
│    4 / 7 correct (57%)      │
├─────────────────────────────┤
│  γεια         new → stage_1 │  ← Advanced (positive)
│  ευχαριστώ    stage_1 → new │  ← Rolled back (negative)
│  νερό         stage_2 ●     │  ← Stayed (neutral)
├─────────────────────────────┤
│  [ Back to Home ]           │
└─────────────────────────────┘
```

### Summary

- `{correct} / {total_exercises} correct ({percentage}%)`
- `correct` = `summary.correct`, `total_exercises` = `summary.total_exercises`

### Per-word list

For each entry in `words` array:

| Condition                  | Display                                 | Visual          |
|----------------------------|-----------------------------------------|-----------------|
| `new_stage` > `prev_stage` | `{original}  {prev} → {new}`          | Green/positive  |
| `new_stage` < `prev_stage` | `{original}  {prev} → {new}`          | Red/negative    |
| `new_stage` = `prev_stage` | `{original}  {stage} ●`               | Neutral         |

- `previous_stage === null` → display as `"new"` (first encounter)

**Stage display names** (localized via i18n):

| srs_stage | EN        | RU          |
|-----------|-----------|-------------|
| new       | New       | Новое       |
| stage_1   | Stage 1   | Этап 1      |
| stage_2   | Stage 2   | Этап 2      |
| stage_3   | Stage 3   | Этап 3      |
| stage_4   | Stage 4   | Этап 4      |
| learned   | Learned   | Выучено     |

### Navigation

- "Back to Home" button → navigate to Home (triggers stats refetch)
- Telegram BackButton → same behavior

### Acceptance criteria

- Summary shows correct count, total, and percentage
- Each word shows `original` + stage transition with visual indicator (green/red/neutral)
- `previous_stage: null` displayed as "new"
- "Back to Home" returns to Home with refreshed stats
- Telegram BackButton works identically

---

## Task 14: Deployment — Dockerfiles, compose, nginx

**Depends on:** Tasks 1–13

**Package:** root

**Goal:** Create all deployment artifacts for production Docker Compose setup.

### Files to create

#### `packages/api/Dockerfile`

Multi-stage Node.js 20-alpine build:

1. **Build stage:** install pnpm, copy workspace files, `pnpm install`, build `shared` then `api`
2. **Production stage:** copy built output + production `node_modules`
3. **Entrypoint:** run `pnpm db:migrate` then start the server
4. Run as non-root user

#### `packages/bot/Dockerfile`

Multi-stage Node.js 20-alpine build:

1. Build `shared` then `bot`
2. Copy built output to production stage
3. **Entrypoint:** start the bot
4. No exposed ports (long polling)

#### `packages/webapp/Dockerfile`

Multi-stage build → nginx:

1. **Build stage:** Node.js 20-alpine, install deps, build `shared` then `webapp`
   - Accept `VITE_API_URL` as a build arg (`ARG VITE_API_URL`)
2. **Production stage:** nginx:alpine, copy built files to `/usr/share/nginx/html`, copy `nginx.conf`

#### `packages/webapp/nginx.conf`

Exactly as in DEPLOY.md § nginx Configuration:

```nginx
server {
    listen 80;

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    location /api/internal/ {
        return 403;
    }

    location /api/ {
        proxy_pass http://api:3000/;
    }
}
```

#### `docker-compose.yml`

Exactly as in DEPLOY.md § docker-compose.yml. Services: `postgres`, `api`, `bot`, `webapp`. Health checks, `depends_on`, restart policies, volumes, networks.

### Dockerfile best practices

- Use specific base image tags (e.g., `node:20-alpine`)
- Copy `package.json` + lockfile first, then install — leverage Docker layer caching
- Use multi-stage builds to minimize production image size
- Run as non-root user in production stage
- Use `.dockerignore` to exclude `node_modules`, `.git`, `dist`, `.env`

### Acceptance criteria

- `docker compose build` succeeds for all services
- `docker compose up -d` starts all services
- `postgres` healthcheck passes
- `api` runs migrations on startup, healthcheck passes
- `bot` starts and connects to Telegram (visible in logs)
- `webapp` serves React SPA on port 80
- `/api/*` requests proxied to api service correctly
- `/api/internal/*` returns 403 from outside the Docker network
- `docker compose down` stops everything cleanly
