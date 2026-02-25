# Hellenic Bot — Core Logic & Database

## Overview

PostgreSQL database for a Greek language learning Telegram bot. Content (words) is managed by the developer through Drizzle migrations. Users interact only as learners.

Word selection is dynamic — there are no predefined sets. The app builds each exercise batch on the fly based on the user's progress state.

## ER Diagram

```
┌──────────────────┐       ┌──────────────────┐       ┌───────────────┐
│      users       │       │  user_progress   │       │     words     │
├──────────────────┤       ├──────────────────┤       ├───────────────┤
│ id (PK)          │──┐    │ id (PK)          │    ┌──│ id (PK)       │
│ telegram_id      │  └───>│ user_id (FK)     │    │  │ original      │
│ first_name       │       │ word_id (FK)     │<───┘  │ transcription │
│ last_name        │       │ srs_stage        │       │ translations  │
│ username         │       │ next_review_at   │       │ created_at    │
│ language_code    │       │ last_reviewed_at │       └───────┬───────┘
│ display_language │       │ created_at       │               │
│ words_per_lesson │       └──────────────────┘               │
│ created_at       │                                          │
│ updated_at       │       ┌──────────────────┐               │
└──────────────────┘       │ exercise_results │               │
       │                   ├──────────────────┤               │
       │                   │ id (PK)          │               │
       └──────────────────>│ user_id (FK)     │               │
                           │ word_id (FK)     │<──────────────┘
                           │ exercise_type    │
                           │ is_correct       │
                           │ answer_given     │
                           │ time_spent_ms    │
                           │ created_at       │
                           └──────────────────┘
```

## Tables

### users

Telegram users who interact with the bot.

| Column           | Type           | Constraints              | Description                                      |
|------------------|----------------|--------------------------|--------------------------------------------------|
| id               | `serial`       | PK                       | Internal ID                                      |
| telegram_id      | `bigint`       | UNIQUE, NOT NULL         | Telegram user ID                                 |
| first_name       | `varchar(255)` | NOT NULL                 | Telegram first name                              |
| last_name        | `varchar(255)` |                          | Telegram last name                               |
| username         | `varchar(255)` |                          | Telegram username                                |
| language_code    | `varchar(10)`  |                          | Telegram client language (e.g. `en`, `ru`)       |
| display_language | `varchar(10)`  | NOT NULL, DEFAULT 'en'   | UI and translation language, user-selectable      |
| words_per_lesson | `integer`      | NOT NULL, DEFAULT 5      | Number of words per lesson session                |
| created_at       | `timestamptz`  | NOT NULL, DEFAULT now()  | Registration timestamp                           |
| updated_at       | `timestamptz`  | NOT NULL, DEFAULT now()  | Last profile update                              |

**Notes:**
- `telegram_id` is `bigint` because Telegram user IDs can exceed 32-bit range.
- Profile fields (`first_name`, `username`, etc.) are synced from Telegram on each interaction.
- `display_language` is derived from `language_code` on first registration: set to `language_code` if it matches a supported language (`en`, `ru`), otherwise defaults to `en`. Can be changed by the user in Mini App settings. Determines both UI language and which translation key to use from `words.translations`.
- `words_per_lesson` controls how many words are selected per lesson session. Changeable in Mini App settings.

---

### words

Greek vocabulary items. Managed by the developer via migrations.

| Column        | Type           | Constraints             | Description                                                  |
|---------------|----------------|-------------------------|--------------------------------------------------------------|
| id            | `serial`       | PK                      | Internal ID                                                  |
| original      | `varchar(255)` | UNIQUE, NOT NULL        | Greek word or phrase                                         |
| transcription | `varchar(255)` |                         | Phonetic transcription (Latin characters)                    |
| translations  | `jsonb`        | NOT NULL                | Translations keyed by language: `{"ru": "...", "en": "..."}` |
| created_at    | `timestamptz`  | NOT NULL, DEFAULT now() |                                                              |

**Notes:**
- `translations` is a JSONB object keyed by ISO 639-1 language code. Example:
  ```json
  {"ru": "привет", "en": "hello"}
  ```
- The app selects the translation based on the user's `display_language`. Fallback order: `display_language` → `en`.
- Every word **must** have at least an `en` key in `translations` (used as the ultimate fallback). This is a data integrity requirement enforced at migration time.

---

### user_progress

Per-user, per-word SRS (spaced repetition) state. Created when the user completes a lesson containing the word (via `POST /learn/complete`).

**No record = stage `new`.** If a word has no `user_progress` row for a given user, it is treated as stage `new` for exercise generation and word selection purposes.

| Column           | Type          | Constraints               | Description                    |
|------------------|---------------|---------------------------|--------------------------------|
| id               | `serial`      | PK                        | Internal ID                    |
| user_id          | `integer`     | FK → users.id, NOT NULL   |                                |
| word_id          | `integer`     | FK → words.id, NOT NULL   |                                |
| srs_stage        | `srs_stage`   | NOT NULL, DEFAULT 'new'   | Learning stage (enum)          |
| next_review_at   | `timestamptz` | NOT NULL, DEFAULT now()   | When to show this word next    |
| last_reviewed_at | `timestamptz` |                           | Last review timestamp          |
| created_at       | `timestamptz` | NOT NULL, DEFAULT now()   |                                |

**Indexes:**
- `user_progress_user_word_idx` UNIQUE on (`user_id`, `word_id`)
- `user_progress_review_idx` on (`user_id`, `srs_stage`, `next_review_at`) — covers all word selection queries (continue / review modes filter by `srs_stage` and `next_review_at`)

**Notes:**
- `srs_stage` is a PostgreSQL enum: `new`, `stage_1`, `stage_2`, `stage_3`, `stage_4`, `learned`.
- `next_review_at` is the primary field used to select which words to review.
- The review interval is derived from `srs_stage` in application code (see SRS Algorithm). No separate interval column needed.
- `DEFAULT 'new'` is a safety net. In practice, `srs_stage` is always set explicitly by the stage progression logic when processing lesson results (`POST /learn/complete`).
- A word is considered **learned** when `srs_stage = 'learned'` (see Stage Progression).

---

### exercise_results

History log of every exercise attempt. Append-only — used for analytics and progress tracking.

| Column        | Type          | Constraints             | Description                                                    |
|---------------|---------------|-------------------------|----------------------------------------------------------------|
| id            | `serial`      | PK                      | Internal ID                                                    |
| user_id       | `integer`     | FK → users.id, NOT NULL |                                                                |
| word_id       | `integer`     | FK → words.id, NOT NULL |                                                                |
| exercise_type | `varchar(50)` | NOT NULL                | `flashcard`, `multiple_choice`, `multiple_choice_reverse`, `fill_blank`, `scramble` |
| is_correct    | `boolean`     | NOT NULL                | Whether the answer was correct                                 |
| answer_given  | `varchar(500)`|                         | User's answer (for fill_blank, etc.)                           |
| time_spent_ms | `integer`     |                         | Milliseconds spent on this exercise (optional, nullable)       |
| created_at    | `timestamptz` | NOT NULL, DEFAULT now() |                                                                |

**Indexes:**
- `exercise_results_user_id_idx` on (`user_id`, `created_at`) — for user history
- `exercise_results_word_id_idx` on `word_id` — for word-level analytics

**Notes:**
- This is a **log table** — grows over time, never updated.
- `exercise_type` values are defined in application code, not as a DB enum, for easier evolution.
- Partition by `created_at` if the table grows significantly.

---

## Learning Modes

Word selection is fully dynamic based on `user_progress` state. No predefined sets.

| Mode                  | Query logic                                                                        |
|-----------------------|------------------------------------------------------------------------------------|
| **Learn new**         | Words with no `user_progress` record for this user                                 |
| **Continue learning** | Words where `srs_stage != 'learned'` AND `next_review_at <= now()`                 |
| **Review learned**    | Words where `srs_stage = 'learned'` AND `next_review_at <= now()`                  |

The "Continue learning" button is disabled when there are no in-progress words due for review. Batch sizes and randomization rules are defined in application code.

---

## Stage Progression

A word is considered **learned** when `srs_stage = 'learned'`. Stage progression is evaluated **per word per lesson** based on the total number of errors across all exercises for that word:

| Errors in lesson | Result                                        |
|------------------|-----------------------------------------------|
| 0                | Advance to next stage (+1)                    |
| 1                | Stay at current stage                         |
| >1               | Roll back to previous stage (-1, min: `new`)  |

```
srs_stage:  new → stage_1 → stage_2 → stage_3 → stage_4 → learned

0 errors:   advance →
1 error:    stay ●
>1 errors:  ← roll back (minimum: new)
```

---

## Exercise Types

Defined in application code (not in DB). Initial set:

| Type                      | Description                                                        |
|---------------------------|--------------------------------------------------------------------|
| `flashcard`               | Show original → reveal translation → continue (always correct)     |
| `multiple_choice`         | Show original → pick correct translation from 4 options            |
| `multiple_choice_reverse` | Show translation → pick correct original from 4 options            |
| `scramble`                | Show shuffled letters of the original → user arranges them in order |
| `fill_blank`              | Type the original word given the translation                       |

### Exercises per Stage

Each word receives a fixed set of exercises per lesson, determined by its current `srs_stage`:

| srs_stage           | Exercises                                                  | Count |
|---------------------|------------------------------------------------------------|-------|
| `new`               | `flashcard`, `multiple_choice`                             | 2     |
| `stage_1`           | `multiple_choice`, `multiple_choice_reverse`               | 2     |
| `stage_2`           | `multiple_choice`, `multiple_choice_reverse`, `fill_blank` | 3     |
| `stage_3`           | `scramble`, `fill_blank`                                   | 2     |
| `stage_4`           | `scramble`, `fill_blank`                                   | 2     |
| `learned`           | `scramble`, `fill_blank`                                   | 2     |

**Note:** at stage `new`, only `multiple_choice` is graded (`flashcard` is always correct), so the maximum error count per word is 1. The ">1 errors → roll back" rule cannot apply to `new` stage words.

**Open design questions:**
- Minimum word length for `scramble` exercise: words with fewer than 3 characters may not produce a meaningful scramble. Threshold and fallback behavior TBD.
- Scramble shuffle guarantee: the shuffled array may accidentally match the original order. Re-shuffle behavior TBD.
- Multi-word phrases: handling of `original` values containing spaces for `scramble` and `fill_blank` exercises TBD.

---

## SRS Algorithm

Fixed interval schedule — no dynamic ease factor.

1. **Stage transition** — evaluated once per word at the end of a lesson:

   | Errors | Action                                       | next_review_at         |
   |--------|----------------------------------------------|------------------------|
   | 0      | Advance to next stage (+1)                   | now() + stage interval |
   | 1      | Stay at current stage                        | now()                  |
   | >1     | Roll back to previous stage (-1, min: `new`) | now()                  |

2. **Stage intervals** (applied on advance):

   | srs_stage (before) | srs_stage (after) | Interval | Meaning                   |
   |--------------------|-------------------|----------|---------------------------|
   | `new`              | `stage_1`         | 0 min    | Available for next lesson |
   | `stage_1`          | `stage_2`         | 0 min    | Available for next lesson |
   | `stage_2`          | `stage_3`         | 1440 min | Review in 1 day           |
   | `stage_3`          | `stage_4`         | 1440 min | Review in 1 day           |
   | `stage_4`          | `learned`         | 1440 min | Learned, review in 1 day  |
   | `learned`          | `learned`         | 1440 min | Stays learned             |

   **Stay / roll back** — `next_review_at = now()` (word is immediately available for the next lesson):

   | Outcome    | Example                        | next_review_at |
   |------------|--------------------------------|----------------|
   | 1 error    | `learned` stays `learned`      | `now()`        |
   | >1 errors  | `learned` rolls back → `stage_4` | `now()`     |

   **Note:** a `learned` word with 1 error stays `learned` but becomes immediately due for review (no 1-day interval). The word will keep appearing until the user answers with 0 errors.

3. **Best case timeline:**
   ```
   Day 1 lesson 1: new → stage_1 (0 min)
   Day 1 lesson 2: stage_1 → stage_2 (0 min)
   Day 1 lesson 3: stage_2 → stage_3 (interval 1 day)
   Day 2: stage_3 → stage_4 (interval 1 day)
   Day 3: stage_4 → learned
   ```
   Minimum **3 days** with no mistakes.

4. **Fetching due words:** each learning mode uses its own query — see Key Queries section below.

---

## Key Queries

### Get new (unstudied) words
```sql
SELECT w.*
FROM words w
LEFT JOIN user_progress up ON up.word_id = w.id AND up.user_id = $1
WHERE up.id IS NULL
ORDER BY random()
LIMIT $2;  -- words_per_lesson
```

### Get words in progress (not yet learned, due for review)
```sql
SELECT w.*, up.srs_stage, up.next_review_at
FROM user_progress up
JOIN words w ON w.id = up.word_id
WHERE up.user_id = $1
  AND up.srs_stage != 'learned'
  AND up.next_review_at <= now()
ORDER BY random()
LIMIT $2;  -- words_per_lesson
```

### Get words due for review (learned words ready for repetition)
```sql
SELECT w.*, up.srs_stage, up.next_review_at
FROM user_progress up
JOIN words w ON w.id = up.word_id
WHERE up.user_id = $1
  AND up.srs_stage = 'learned'
  AND up.next_review_at <= now()
ORDER BY random()
LIMIT $2;  -- words_per_lesson
```

### Check available learning modes for a user
```sql
SELECT
  (SELECT COUNT(*) FROM words w
   LEFT JOIN user_progress up ON up.word_id = w.id AND up.user_id = $1
   WHERE up.id IS NULL
  ) AS new_available,
  (SELECT COUNT(*) FROM user_progress up
   WHERE up.user_id = $1
     AND up.srs_stage != 'learned'
     AND up.next_review_at <= now()
  ) AS continue_available,
  (SELECT COUNT(*) FROM user_progress up
   WHERE up.user_id = $1
     AND up.srs_stage = 'learned'
     AND up.next_review_at <= now()
  ) AS review_available;
```

### Get user's overall progress
```sql
SELECT
  (SELECT COUNT(*) FROM words) AS total_words,
  COUNT(up.id) FILTER (WHERE up.srs_stage = 'learned') AS learned_words
FROM user_progress up
WHERE up.user_id = $1;
```

---

## Cascade Rules

| Parent | Child            | On Delete |
|--------|------------------|-----------|
| users  | user_progress    | CASCADE   |
| users  | exercise_results | CASCADE   |
| words  | user_progress    | CASCADE   |
| words  | exercise_results | CASCADE   |

---

## Word Management

Words are added and updated by the developer through Drizzle migrations. There is no admin UI or import script.

**Minimum word count:** The system requires at least **4 words** in the `words` table for lessons to function. Multiple choice exercises need 3 distractors from other words. If fewer than 4 words exist, lessons cannot be generated.

### Adding / Updating Words

`drizzle-kit generate` creates migrations from **schema diffs** — it won't produce a file for data-only changes. To add or update word data, create a SQL migration file manually:

```bash
# 1. Create a migration file manually (use the next sequential number after existing migrations)
mkdir -p packages/api/drizzle
touch packages/api/drizzle/0004_add_words.sql

# 2. Write INSERT/UPDATE statements:
#    INSERT INTO words (original, transcription, translations)
#    VALUES ('γεια', 'yia', '{"en": "hello", "ru": "привет"}');
#
#    UPDATE words SET translations = '{"en": "hi", "ru": "привет"}'
#    WHERE original = 'γεια';

# 3. Apply
pnpm --filter api db:migrate
```

### Deleting Words

Delete via a migration with `DELETE FROM words WHERE original = '...';`. Cascade rules (see above) automatically remove related `user_progress` and `exercise_results` records.

In production, migrations run automatically on `api` container startup.
