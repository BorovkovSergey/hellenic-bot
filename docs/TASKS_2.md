# Hellenic Bot — Tasks: Notes Field

Add a `notes` column to `words` — a short grammar hint (article, endings, part of speech) displayed during exercises.

## Dependency Graph

```
1 DB migration (add column)
└── 2 Drizzle schema
    ├── 3 Shared schemas (Zod)
    │   ├── 4 API: exercise generation
    │   │   └── 6 Webapp: exercise components
    │   └── 5 API: word selection queries
    └── 7 Seed data migration (populate notes)
```

---

## Task 1: DB migration — add `notes` column

**Depends on:** —

**Goal:** Add nullable `notes varchar(255)` column to the `words` table.

**Create:** `packages/api/drizzle/0002_add_notes_column.sql`

```sql
ALTER TABLE words ADD COLUMN notes varchar(255);
```

No default value — existing rows get `NULL`.

---

## Task 2: Update Drizzle schema

**Depends on:** Task 1

**Goal:** Add `notes` field to the `words` table definition in Drizzle so it's available in queries.

**Modify:** `packages/api/src/db/schema.ts`

Add to the `words` table:
```typescript
notes: varchar("notes", { length: 255 }),
```

Between `translations` and `createdAt`.

---

## Task 3: Update shared Zod schemas

**Depends on:** Task 2

**Goal:** Add `notes` to exercise prompt schemas so the API response type includes it and the webapp can consume it.

**Modify:** `packages/shared/src/schemas.ts`

Add `notes: z.string().nullable()` to `prompt` in all five exercise schemas:

| Schema                          | Current prompt fields              | Add                    |
|---------------------------------|------------------------------------|------------------------|
| `FlashcardExerciseSchema`       | `original`, `transcription?`       | `notes` (nullable)     |
| `MultipleChoiceExerciseSchema`  | `original`, `transcription?`       | `notes` (nullable)     |
| `MultipleChoiceReverseSchema`   | `translation`                      | `notes` (nullable)     |
| `FillBlankExerciseSchema`       | `translation`                      | `notes` (nullable)     |
| `ScrambleExerciseSchema`        | `translation`, `scrambled`         | `notes` (nullable)     |

---

## Task 4: API — include notes in exercise generation

**Depends on:** Task 2, Task 3

**Goal:** Pass `words.notes` through to exercise prompt objects.

**Modify:** `packages/api/src/routes/learn.ts`

Changes:

1. **`WordWithStage` type** — add `notes: string | null`

2. **Word selection queries** (3 places: new / continue / review) — add `w.notes` to SELECT and map it:
   ```typescript
   notes: r.notes ?? null,
   ```

3. **Exercise generation loop** — for each exercise type, include `notes` in `prompt`:

   | Exercise type         | Add to prompt                   |
   |-----------------------|---------------------------------|
   | `flashcard`           | `notes: word.notes ?? null`     |
   | `multiple_choice`     | `notes: word.notes ?? null`     |
   | `multiple_choice_reverse` | `notes: word.notes ?? null` |
   | `fill_blank`          | `notes: word.notes ?? null`     |
   | `scramble`            | `notes: word.notes ?? null`     |

---

## Task 5: API — word selection queries include notes

**Depends on:** Task 2

Covered by Task 4 (same file, same changes). No separate task needed — included in Task 4 for completeness.

---

## Task 6: Webapp — display notes in exercise components

**Depends on:** Task 3, Task 4

**Goal:** Show `notes` in each exercise component as muted italic text, **blurred by default**, revealable on tap. Prevents accidental spoilers (e.g. article hints the word's gender).

### `packages/webapp/src/exercises/NotesHint.tsx` (new shared component)

Extract the blur + reveal logic into a reusable component used by all exercise types:

```tsx
interface NotesHintProps {
  notes: string | null | undefined;
}

export function NotesHint({ notes }: NotesHintProps) {
  const [revealed, setRevealed] = useState(false);

  if (!notes) return null;

  return (
    <div
      onClick={() => setRevealed(true)}
      style={{
        fontSize: "14px",
        color: "var(--tg-theme-text-color)",
        opacity: 0.4,
        fontStyle: "italic",
        filter: revealed ? "none" : "blur(4px)",
        cursor: revealed ? "default" : "pointer",
        transition: "filter 0.2s",
        userSelect: revealed ? "auto" : "none",
      }}
    >
      {notes}
    </div>
  );
}
```

**Behavior:**
- Blurred (`filter: blur(4px)`) by default — text is present but unreadable
- Tap removes blur — single tap, one-way toggle (no re-blur within the same exercise)
- Each exercise remounts the component → blur resets automatically via fresh `useState(false)`
- `userSelect: none` while blurred prevents accidentally copying blurred text

### Exercise component changes

**Modify:**

| File                              | Props change                          | Placement                  |
|-----------------------------------|---------------------------------------|----------------------------|
| `Flashcard.tsx`                   | `prompt.notes?: string \| null`       | Below transcription        |
| `MultipleChoice.tsx`              | `prompt.notes?: string \| null`       | Below transcription        |
| `MultipleChoiceReverse.tsx`       | `prompt.notes?: string \| null`       | Below translation          |
| `FillBlank.tsx`                   | `prompt.notes?: string \| null`       | Below translation          |
| `Scramble.tsx`                    | `prompt.notes?: string \| null`       | Below translation          |

Each component renders `<NotesHint notes={prompt.notes} />` in the appropriate position.

---

## Task 7: Seed data migration — populate notes

**Depends on:** Task 1

**Goal:** Update existing seed words with notes where applicable. Add notes for new words added via future migrations.

**Create:** `packages/api/drizzle/0003_update_seed_notes.sql`

Update existing seed words (from 0001_seed_words.sql):

```sql
-- Most seed words are greetings/common words without articles — no notes needed.
-- νερό and ψωμί have neuter articles:
UPDATE words SET notes = 'το' WHERE original = 'νερό';
UPDATE words SET notes = 'το' WHERE original = 'ψωμί';
```

Future word migrations should include `notes` in INSERT statements (see CORE.md — Word Management examples).
