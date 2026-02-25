# Hellenic Bot — Lesson Session Flow

How a lesson is assembled, executed, and completed.

## Overview

A lesson is a single learning session. The user picks a mode (learn new / continue / review), the server builds a set of exercises, and the user completes them one by one in the Mini App.

```
User picks mode → Server selects words + generates exercises → User completes exercises (client-side) → Client sends all results → Server updates progress
```

## Word Selection

The user's `words_per_lesson` setting (default 5) determines the target number of words per session. Words are selected based on the chosen mode.

### Mode: Learn New

Words with no `user_progress` record for this user. Random selection so each lesson has a unique set of new words.

### Mode: Continue Learning

In-progress words due for review (`srs_stage != 'learned'` AND `next_review_at <= now()`). Random selection from all due words.

### Mode: Review Learned

Learned words due for review (`srs_stage = 'learned'` AND `next_review_at <= now()`). Random selection from all due words.

All word selection queries are defined in CORE.md — Key Queries. Each query limits results to the user's `words_per_lesson` setting.

### Partial Sessions

If fewer words are available than `words_per_lesson`, the lesson uses whatever is available. Minimum: 1 word. If 0 words match — the mode button is disabled on the home screen.

## Exercise Generation

For each selected word, exercises are generated based on its `srs_stage` (see CORE.md — Exercises per Stage). Words without a `user_progress` record (from "Learn New" mode) are treated as stage `new`.

### Ordering

Exercises from all words are **interleaved and shuffled** — not grouped by word. This prevents the user from seeing the same word twice in a row and improves retention.

**Per-word order constraints** (must hold after shuffle):

| Exercise type    | Position          |
|------------------|-------------------|
| `flashcard`      | Before all others |
| `multiple_choice`, `multiple_choice_reverse`, `scramble` | Middle |
| `fill_blank`     | After all others  |

The shuffle is free to interleave exercises from different words, but for any given word the relative order must be: `flashcard` → middle types → `fill_blank`.

Example with 3 words (A, B, C) at `stage_2` — exercises per word: `mc`, `mc_reverse`, `fill_blank`:
```
Generated:  A-mc, A-mc_rev, A-fill, B-mc, B-mc_rev, B-fill, C-mc, C-mc_rev, C-fill
Shuffled:   B-mc, A-mc, C-mc, A-mc_rev, B-mc_rev, A-fill, C-mc_rev, B-fill, C-fill
```
Note: A-fill (pos 6) appears before C-mc_rev (pos 7) — `fill_blank` is last **per word**, not globally last. Per-word relative order is preserved: A(mc→mc_rev→fill), B(mc→mc_rev→fill), C(mc→mc_rev→fill).

### Multiple Choice Options

For `multiple_choice` and `multiple_choice_reverse`, 3 distractor options are randomly selected from other words in the `words` table. Distractors:
- Must be different from the correct answer
- Selected randomly from all other words
- Use the user's `display_language` for translations (same as the correct answer)

The system requires at least 4 words in the `words` table (see CORE.md — Word Management). This guarantees enough distractors for multiple choice exercises.

The correct answer is always at index 0 in the `options` array (see API.md). The client shuffles options for display and tracks the real position after shuffle.

## During the Lesson

Everything happens client-side. The server is not involved until the lesson is complete.

1. The client receives the full exercise list (with answers) from `POST /learn/lesson`
2. Exercises are displayed one at a time
3. The client validates answers locally (correct answer is in the response data)
4. Flashcard exercises always count as correct — the user reveals the answer and taps "Continue", no grading
5. The client shows immediate feedback (correct/incorrect) and advances to the next exercise
6. The client accumulates results in memory: `word_id`, `exercise_type`, `is_correct`, `answer_given`, `time_spent_ms`
7. A progress bar shows position within the lesson

## Lesson Completion

After the last exercise, the client sends all accumulated results in a single `POST /learn/complete` request. The server trusts the client data — no server-side session or verification.

The server:

1. Inserts all results into `exercise_results`
2. Aggregates errors per word
3. Applies stage progression rules (see CORE.md — Stage Progression):
   - 0 errors → advance to next stage, set `next_review_at` per SRS interval
   - 1 error → stay at current stage, set `next_review_at = now()`
   - \>1 errors → roll back one stage (min: `new`), set `next_review_at = now()`
4. Updates `user_progress` for each word
5. Returns a summary to the client

## Answer Comparison Rules

### Fill Blank

User input is compared to `answer.original` with the following normalization:

- **Trim** whitespace
- **Case-insensitive** (lowercased before comparison)
- Accents **must match exactly** — accent placement in Greek distinguishes word meanings (e.g. `νέρο` ≠ `νερό`)

Comparison happens client-side. The server trusts `is_correct` from the client.

### Scramble

The user assembles the word from provided letter tiles. The assembled string is compared to `answer.original` as an **exact match** — no normalization needed since the available letters (including accents and casing) come directly from the original word.

Comparison happens client-side.

---

## Edge Cases

### User Closes App Mid-Lesson

- Results are only in client memory — nothing is sent to the server
- No `exercise_results` are saved, no `user_progress` changes
- The lesson is simply lost
- Next time the user starts a lesson, word selection runs fresh based on current `user_progress` state

### Empty Word Pool

- If no words match the selected mode → the mode button is disabled on the home screen
- The `GET /learn/stats` endpoint returns counts for each mode so the client knows which buttons to enable

### All Words Learned

- "Learn new" button disabled (no unstudied words)
- "Continue learning" disabled (no in-progress words due)
- "Review learned" available when learned words become due based on their `next_review_at`
- If nothing is due at all, the home screen shows a "come back later" state
