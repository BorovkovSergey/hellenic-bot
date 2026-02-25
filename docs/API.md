# Hellenic Bot — API Endpoints

HTTP API consumed by the Mini App via Hono RPC. All endpoints return JSON.

## Authentication

The Mini App sends Telegram `initData` on first load. The API validates it and returns a session token for subsequent requests.

### Flow

```
Mini App opens → sends initData to POST /auth/validate
    │
    ├── Server validates initData signature using BOT_TOKEN
    ├── Upserts user from initData.user
    └── Returns JWT token + user profile

Subsequent requests → Authorization: Bearer <token>
```

### initData Validation Algorithm

Telegram standard HMAC-SHA256 verification:

1. Parse `init_data` as URL search params
2. Extract and remove `hash` param
3. Sort remaining params alphabetically by key
4. Join as `key=value\n` (newline-separated, no trailing newline)
5. Compute HMAC-SHA256 of the bot token using the literal string `"WebAppData"` as the key → `secret_key`
6. Compute HMAC-SHA256 of the data check string (step 4) using `secret_key` → `computed_hash`
7. Compare `computed_hash` (hex) to the extracted `hash` value

**Key detail (step 5):** `"WebAppData"` is the HMAC **key**, the bot token is the HMAC **data**. This matches the Telegram documentation: `secret_key = HMAC_SHA256(key="WebAppData", data=bot_token)`.

---

### JWT Payload

```json
{
  "sub": 1,            // users.id
  "tid": 123456789,    // telegram_id
  "iat": 1700000000,
  "exp": 1700086400    // 24h TTL
}
```

Token is signed with `BOT_TOKEN` as the secret (no extra secret needed). TTL: 24 hours (86400 seconds).

---

## Endpoints

All endpoints require authentication (`Authorization: Bearer <token>`) unless explicitly marked otherwise.

### `GET /health`

Health check endpoint for Docker. No authentication.

**Response `200`:**
```json
{ "status": "ok" }
```

---

### `POST /auth/validate`

Validate Telegram Mini App initData and authenticate the user. No authentication (this endpoint issues tokens).

**Request:**
```json
{
  "init_data": "query_id=...&user=...&auth_date=...&hash=..."
}
```

**Response `200`:**
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": 1,
    "telegram_id": 123456789,
    "first_name": "Alex",
    "last_name": "K",
    "username": "alexk",
    "display_language": "en",
    "words_per_lesson": 5
  }
}
```

**Notes:**
- Upserts the user record from `initData.user` (same fields as the bot's `/start` upsert — see BOT.md). This ensures profile data stays fresh even if the user opens the Mini App without going through `/start`.
- The `user` object has the same shape as `GET /users/me`.

**Errors:**
- `400 VALIDATION_ERROR` — missing or malformed `init_data` field
- `401 UNAUTHORIZED` — invalid or expired initData

---

### `POST /internal/users/upsert`

Internal endpoint called by the bot to register or update a user. Not exposed to the internet — secured by nginx path blocking (see DEPLOY.md) and Docker network isolation.

**Request:**
```json
{
  "telegram_id": 123456789,
  "first_name": "Alex",
  "last_name": "K",
  "username": "alexk",
  "language_code": "en"
}
```

**Response `200`:**
```json
{
  "id": 1,
  "telegram_id": 123456789,
  "first_name": "Alex",
  "last_name": "K",
  "username": "alexk",
  "display_language": "en",
  "words_per_lesson": 5
}
```

**Notes:**
- Response has the same shape as `GET /users/me`.
- If user exists: updates `first_name`, `last_name`, `username`, `language_code`, `updated_at`
- If new user: creates with `display_language` derived from `language_code` (set to `language_code` if it matches a supported language — `en`, `ru` — otherwise defaults to `en`), `words_per_lesson` = 5
- No authentication — secured by nginx blocking `/api/internal/` from external access (see DEPLOY.md) and Docker network isolation

---

### `GET /users/me`

Get current user profile and settings.

**Response `200`:**
```json
{
  "id": 1,
  "telegram_id": 123456789,
  "first_name": "Alex",
  "last_name": "K",
  "username": "alexk",
  "display_language": "en",
  "words_per_lesson": 5
}
```

---

### `PATCH /users/me/settings`

Update user settings. Only provided fields are updated.

**Request:**
```json
{
  "display_language": "ru",
  "words_per_lesson": 10
}
```

**Validation:**
- `display_language`: one of `"en"`, `"ru"`
- `words_per_lesson`: integer, 1–20

**Response `200`:** updated user object (same shape as `GET /users/me`)

**Errors:**
- `400 VALIDATION_ERROR` — invalid settings values

---

### `GET /learn/stats`

Home screen data: available word counts per mode.

**Response `200`:**
```json
{
  "new_available": 42,
  "continue_available": 5,
  "review_available": 3,
  "total_words": 100,
  "learned_words": 30
}
```

- `new_available` — words with no `user_progress` record
- `continue_available` — in-progress words due for review (`srs_stage != 'learned'` AND `next_review_at <= now()`)
- `review_available` — learned words due for review (`srs_stage = 'learned'` AND `next_review_at <= now()`)
- `total_words` — total words in the system
- `learned_words` — words where `srs_stage = 'learned'`

---

### `POST /learn/lesson`

Start a new lesson. Selects words and generates exercises.

**Request:**
```json
{
  "mode": "continue"
}
```

- `mode`: one of `"new"`, `"continue"`, `"review"`

**Response `200`:**

The example below uses `mode: "continue"` — words are at different SRS stages, so different exercise types are generated per word (see CORE.md — Exercises per Stage).

```json
{
  "exercises": [
    {
      "word_id": 42,
      "exercise_type": "flashcard",
      "prompt": {
        "original": "γεια",
        "transcription": "yia"
      },
      "answer": {
        "translation": "hello"
      }
    },
    {
      "word_id": 43,
      "exercise_type": "multiple_choice",
      "prompt": {
        "original": "ευχαριστώ",
        "transcription": "efcharistó"
      },
      "options": ["thank you", "goodbye", "please", "sorry"],
      "correct_index": 0
    },
    {
      "word_id": 42,
      "exercise_type": "multiple_choice",
      "prompt": {
        "original": "γεια",
        "transcription": "yia"
      },
      "options": ["hello", "water", "bread", "house"],
      "correct_index": 0
    },
    {
      "word_id": 44,
      "exercise_type": "scramble",
      "prompt": {
        "translation": "water",
        "scrambled": [["ό", "ν", "ρ", "ε"]]
      },
      "answer": {
        "original": "νερό"
      }
    },
    {
      "word_id": 43,
      "exercise_type": "multiple_choice_reverse",
      "prompt": {
        "translation": "thank you"
      },
      "options": [
        { "original": "ευχαριστώ", "transcription": "efcharistó" },
        { "original": "αντίο", "transcription": "adío" },
        { "original": "παρακαλώ", "transcription": "parakaló" },
        { "original": "συγνώμη", "transcription": "signómi" }
      ],
      "correct_index": 0
    },
    {
      "word_id": 44,
      "exercise_type": "fill_blank",
      "prompt": {
        "translation": "water"
      },
      "answer": {
        "original": "νερό"
      }
    }
  ]
}
```

**Notes:**
- In this example: word 42 is at stage `new` (rolled back), word 43 at `stage_1`, word 44 at `stage_3` — hence different exercise types per word
- For `mode: "new"`, all words are at stage `new` — every word gets `flashcard` + `multiple_choice` only:
  ```json
  {
    "exercises": [
      {
        "word_id": 42,
        "exercise_type": "flashcard",
        "prompt": { "original": "γεια", "transcription": "yia" },
        "answer": { "translation": "hello" }
      },
      {
        "word_id": 43,
        "exercise_type": "flashcard",
        "prompt": { "original": "ευχαριστώ", "transcription": "efcharistó" },
        "answer": { "translation": "thank you" }
      },
      {
        "word_id": 42,
        "exercise_type": "multiple_choice",
        "prompt": { "original": "γεια", "transcription": "yia" },
        "options": ["hello", "water", "bread", "house"],
        "correct_index": 0
      },
      {
        "word_id": 43,
        "exercise_type": "multiple_choice",
        "prompt": { "original": "ευχαριστώ", "transcription": "efcharistó" },
        "options": ["thank you", "goodbye", "please", "sorry"],
        "correct_index": 0
      }
    ]
  }
  ```
- Exercises are pre-shuffled (interleaved across words), but per-word relative order is preserved: `flashcard` → middle types → `fill_blank` (see LESSON.md — Ordering)
- All answers are included in the response — the client validates locally and is trusted
- For flashcards, `answer` is revealed on tap — always counts as correct (`is_correct: true`), no user grading
- For multiple choice and multiple choice reverse, the correct answer is always at `correct_index: 0` in the `options` array. The client must shuffle options for display and track the real position after shuffle
- For multiple choice, options are translation strings
- For multiple choice reverse, options are objects with `original` and `transcription` fields
- For fill_blank, `answer.original` is used for comparison
- For scramble, `prompt.scrambled` is `string[][]` — an array of groups, one per word in the original phrase. Each group contains the shuffled characters of that word. For single words: `[["ό","ν","ρ","ε"]]`. For multi-word phrases (e.g. `"καλημέρα σας"`): `[["μ","ά","κ","η","ε","λ","ρ","α"],["σ","α","ς"]]`. Spaces between groups are fixed and non-interactive in the UI
- Translations and option labels use the user's `display_language`. If the key is missing from `words.translations`, falls back to `en`

**Errors:**
- `400 NO_WORDS` — no words available for the selected mode

---

### `POST /learn/complete`

Submit lesson results. The client collects all exercise results locally and sends them in a single request at the end. The server trusts the client — no server-side session tracking.

**Request:**
```json
{
  "results": [
    {
      "word_id": 42,
      "exercise_type": "flashcard",
      "is_correct": true,
      "answer_given": null,
      "time_spent_ms": 3100
    },
    {
      "word_id": 43,
      "exercise_type": "multiple_choice",
      "is_correct": false,
      "answer_given": "goodbye",
      "time_spent_ms": 4200
    },
    {
      "word_id": 42,
      "exercise_type": "multiple_choice",
      "is_correct": true,
      "answer_given": "hello",
      "time_spent_ms": 2300
    },
    {
      "word_id": 44,
      "exercise_type": "scramble",
      "is_correct": true,
      "answer_given": "νερό",
      "time_spent_ms": 5200
    },
    {
      "word_id": 43,
      "exercise_type": "multiple_choice_reverse",
      "is_correct": false,
      "answer_given": "αντίο",
      "time_spent_ms": 3800
    },
    {
      "word_id": 44,
      "exercise_type": "fill_blank",
      "is_correct": true,
      "answer_given": "νερό",
      "time_spent_ms": 6100
    }
  ]
}
```

**`answer_given` by exercise type:**

| Exercise type             | `answer_given`                                | Example              |
|---------------------------|-----------------------------------------------|----------------------|
| `flashcard`               | `null` (always correct, no user input)        | `null`               |
| `multiple_choice`         | Selected translation string                   | `"goodbye"`          |
| `multiple_choice_reverse` | Selected original (Greek) string              | `"αντίο"`            |
| `fill_blank`              | User's typed text                             | `"νερο"`             |
| `scramble`                | User's assembled string                       | `"νερό"`             |

The server:
1. Inserts all results into `exercise_results`
2. Aggregates errors per word (count of `is_correct: false` per `word_id`; flashcard exercises are always `is_correct: true` and do not contribute to error count)
3. Applies stage progression (see CORE.md)
4. Updates `user_progress` (creates a new record for words encountered for the first time)
5. Returns summary

**Response `200`:**
```json
{
  "words": [
    {
      "word_id": 42,
      "original": "γεια",
      "errors": 0,
      "previous_stage": "new",
      "new_stage": "stage_1"
    },
    {
      "word_id": 43,
      "original": "ευχαριστώ",
      "errors": 2,
      "previous_stage": "stage_1",
      "new_stage": "new"
    },
    {
      "word_id": 44,
      "original": "νερό",
      "errors": 0,
      "previous_stage": "stage_3",
      "new_stage": "stage_4"
    }
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

**Validation:**
- `results` — non-empty array
- `results[].word_id` — required, integer
- `results[].exercise_type` — required, one of `flashcard`, `multiple_choice`, `multiple_choice_reverse`, `fill_blank`, `scramble`
- `results[].is_correct` — required, boolean
- `results[].time_spent_ms` — optional, integer, >= 0
- `results[].answer_given` — string or `null` (must be explicitly `null` for flashcard; typed text for fill_blank/scramble; selected option text for multiple choice variants)

**Notes:**
- `summary.words_advanced` — words with 0 errors (advanced to next stage)
- `summary.words_stayed` — words with exactly 1 error (stayed at current stage)
- `summary.words_rolled_back` — words with >1 errors (rolled back one stage)
- `summary.words_advanced + words_stayed + words_rolled_back` = number of unique words in the lesson
- `previous_stage` is `null` for words encountered for the first time (no prior `user_progress` record). The client should display `null` as `"new"` (see WEBAPP.md — Lesson Complete).
- For words with an existing record, `previous_stage` is the `srs_stage` value before the lesson.
- Flashcard exercises always count as correct and do not contribute to the error count.
- The `words` array order in the response is not guaranteed.
- All database operations (inserting results, updating/creating progress) are executed in a single transaction — if any step fails, the entire operation is rolled back.

**Errors:**
- `400 VALIDATION_ERROR` — invalid request body (empty results, missing fields, invalid exercise_type)

---

## Trust Model

The server trusts the client. There is no server-side session linking `POST /learn/lesson` to `POST /learn/complete`.

**Known limitations:**
- **Duplicate submissions** — the client can send results for the same lesson multiple times, causing duplicate `exercise_results` and repeated stage transitions. No `session_id` mechanism exists to prevent this.
- **Arbitrary word_ids** — the server does not verify that submitted `word_id` values were part of the lesson returned by `POST /learn/lesson`. A client could submit results for any word. If a `word_id` does not exist in the `words` table, the foreign key constraint on `exercise_results` will cause the transaction to fail with `500 INTERNAL_ERROR`.

These are accepted trade-offs for v1 simplicity (no server-side session state).

---

## Error Format

All errors follow this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "words_per_lesson must be between 1 and 20"
  }
}
```

### Error Codes

| Code               | HTTP Status | Description                          |
|--------------------|-------------|--------------------------------------|
| `UNAUTHORIZED`     | 401         | Missing or invalid token             |
| `VALIDATION_ERROR` | 400         | Invalid request body                 |
| `NOT_FOUND`        | 404         | Resource not found                   |
| `NO_WORDS`         | 400         | No words available for selected mode |
| `INTERNAL_ERROR`   | 500         | Unexpected server error              |

## Routing

All endpoint paths in this document are as defined in Hono (e.g. `/auth/validate`, `/learn/stats`). In production, nginx reverse-proxies `/api/*` to the API service and **strips the `/api` prefix** — so the client sends `GET /api/learn/stats`, which arrives at Hono as `GET /learn/stats`. See DEPLOY.md for nginx configuration details.

## Hono RPC

The API is consumed via Hono RPC — the client gets a fully typed API client inferred from the server route definitions. No codegen or manual type maintenance needed.

```typescript
// In webapp — client is fully typed
import { hc } from "hono/client";
import type { AppType } from "@hellenic-bot/api";

const client = hc<AppType>(import.meta.env.VITE_API_URL);

// Autocomplete + type checking
const res = await client.learn.stats.$get();
const data = await res.json();
// data.new_available — typed as number
```

`VITE_API_URL` is set to `/api` — passed as a build arg in `docker-compose.yml` (see DEPLOY.md).
