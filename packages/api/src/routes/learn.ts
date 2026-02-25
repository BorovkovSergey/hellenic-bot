import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, ne, and, lte, sql, isNull, not } from "drizzle-orm";
import {
  StartLessonRequestSchema,
  CompleteLessonRequestSchema,
  computeProgression,
  getExercisesForStage,
  type SrsStage,
  type Exercise as ExerciseType,
} from "@hellenic-bot/shared";
import { db } from "../db/index.js";
import { users, words, userProgress, exerciseResults } from "../db/schema.js";
import { AppError } from "../middleware/error.js";
import type { Env } from "../types.js";

const learn = new Hono<Env>();

// GET /learn/stats
learn.get("/stats", async (c) => {
  const userId = c.get("userId") as number;

  const [stats] = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM words w
       LEFT JOIN user_progress up ON up.word_id = w.id AND up.user_id = ${userId}
       WHERE up.id IS NULL
      ) AS new_available,
      (SELECT COUNT(*)::int FROM user_progress up
       WHERE up.user_id = ${userId}
         AND up.srs_stage != 'learned'
         AND up.next_review_at <= now()
      ) AS continue_available,
      (SELECT COUNT(*)::int FROM user_progress up
       WHERE up.user_id = ${userId}
         AND up.srs_stage = 'learned'
         AND up.next_review_at <= now()
      ) AS review_available,
      (SELECT COUNT(*)::int FROM words) AS total_words,
      (SELECT COUNT(*)::int FROM user_progress up
       WHERE up.user_id = ${userId}
         AND up.srs_stage = 'learned'
      ) AS learned_words
  `);

  return c.json({
    new_available: stats.new_available as number,
    continue_available: stats.continue_available as number,
    review_available: stats.review_available as number,
    total_words: stats.total_words as number,
    learned_words: stats.learned_words as number,
  });
});

// Helper: get translation for a word
function getTranslation(
  translations: Record<string, string>,
  lang: string,
): string {
  return translations[lang] ?? translations["en"] ?? "";
}

// Helper: shuffle array (Fisher-Yates)
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Helper: scramble word characters
function scrambleWord(original: string): string[][] {
  const parts = original.split(" ");
  return parts.map((part) => {
    const chars = [...part];
    return shuffle(chars);
  });
}

// POST /learn/lesson
learn.post(
  "/lesson",
  zValidator("json", StartLessonRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid request" } },
        400,
      );
    }
  }),
  async (c) => {
    const userId = c.get("userId") as number;
    const { mode } = c.req.valid("json");

    // Get user settings
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const limit = user.wordsPerLesson;
    const displayLang = user.displayLanguage;

    type WordWithStage = {
      id: number;
      original: string;
      transcription: string | null;
      translations: Record<string, string>;
      notes: string | null;
      srsStage: SrsStage;
    };

    let selectedWords: WordWithStage[] = [];

    if (mode === "new") {
      const rows = await db.execute(sql`
        SELECT w.id, w.original, w.transcription, w.translations, w.notes
        FROM words w
        LEFT JOIN user_progress up ON up.word_id = w.id AND up.user_id = ${userId}
        WHERE up.id IS NULL
        ORDER BY random()
        LIMIT ${limit}
      `);
      selectedWords = (rows as any[]).map((r: any) => ({
        id: r.id,
        original: r.original,
        transcription: r.transcription,
        translations:
          typeof r.translations === "string"
            ? JSON.parse(r.translations)
            : r.translations,
        notes: r.notes ?? null,
        srsStage: "new" as SrsStage,
      }));
    } else if (mode === "continue") {
      const rows = await db.execute(sql`
        SELECT w.id, w.original, w.transcription, w.translations, w.notes, up.srs_stage
        FROM user_progress up
        JOIN words w ON w.id = up.word_id
        WHERE up.user_id = ${userId}
          AND up.srs_stage != 'learned'
          AND up.next_review_at <= now()
        ORDER BY random()
        LIMIT ${limit}
      `);
      selectedWords = (rows as any[]).map((r: any) => ({
        id: r.id,
        original: r.original,
        transcription: r.transcription,
        translations:
          typeof r.translations === "string"
            ? JSON.parse(r.translations)
            : r.translations,
        notes: r.notes ?? null,
        srsStage: r.srs_stage as SrsStage,
      }));
    } else {
      // review
      const rows = await db.execute(sql`
        SELECT w.id, w.original, w.transcription, w.translations, w.notes, up.srs_stage
        FROM user_progress up
        JOIN words w ON w.id = up.word_id
        WHERE up.user_id = ${userId}
          AND up.srs_stage = 'learned'
          AND up.next_review_at <= now()
        ORDER BY random()
        LIMIT ${limit}
      `);
      selectedWords = (rows as any[]).map((r: any) => ({
        id: r.id,
        original: r.original,
        transcription: r.transcription,
        translations:
          typeof r.translations === "string"
            ? JSON.parse(r.translations)
            : r.translations,
        notes: r.notes ?? null,
        srsStage: r.srs_stage as SrsStage,
      }));
    }

    if (selectedWords.length === 0) {
      return c.json(
        { error: { code: "NO_WORDS", message: "No words available for selected mode" } },
        400,
      );
    }

    // Get all words for distractors
    const allWords = await db.select().from(words);

    // Generate exercises per word
    const exercisesPerWord: { wordIdx: number; exercises: ExerciseType[] }[] = [];

    for (let wi = 0; wi < selectedWords.length; wi++) {
      const word = selectedWords[wi];
      const exerciseTypes = getExercisesForStage(word.srsStage);
      const wordExercises: ExerciseType[] = [];

      for (const type of exerciseTypes) {
        const translation = getTranslation(word.translations, displayLang);

        if (type === "flashcard") {
          wordExercises.push({
            word_id: word.id,
            exercise_type: "flashcard",
            prompt: {
              original: word.original,
              transcription: word.transcription ?? undefined,
              notes: word.notes,
            },
            answer: { translation },
          });
        } else if (type === "multiple_choice") {
          const distractors = shuffle(
            allWords.filter((w) => w.id !== word.id),
          ).slice(0, 3);
          const options = [
            translation,
            ...distractors.map((d) => getTranslation(d.translations, displayLang)),
          ];
          wordExercises.push({
            word_id: word.id,
            exercise_type: "multiple_choice",
            prompt: {
              original: word.original,
              transcription: word.transcription ?? undefined,
              notes: word.notes,
            },
            options,
            correct_index: 0,
          });
        } else if (type === "multiple_choice_reverse") {
          const distractors = shuffle(
            allWords.filter((w) => w.id !== word.id),
          ).slice(0, 3);
          const options = [
            {
              original: word.original,
              transcription: word.transcription ?? undefined,
            },
            ...distractors.map((d) => ({
              original: d.original,
              transcription: d.transcription ?? undefined,
            })),
          ];
          wordExercises.push({
            word_id: word.id,
            exercise_type: "multiple_choice_reverse",
            prompt: { translation, notes: word.notes },
            options,
            correct_index: 0,
          });
        } else if (type === "fill_blank") {
          wordExercises.push({
            word_id: word.id,
            exercise_type: "fill_blank",
            prompt: { translation, notes: word.notes },
            answer: { original: word.original },
          });
        } else if (type === "scramble") {
          wordExercises.push({
            word_id: word.id,
            exercise_type: "scramble",
            prompt: {
              translation,
              scrambled: scrambleWord(word.original),
              notes: word.notes,
            },
            answer: { original: word.original },
          });
        }
      }

      exercisesPerWord.push({ wordIdx: wi, exercises: wordExercises });
    }

    // Interleave exercises: round-based ordering
    const maxExercisesPerWord = Math.max(
      ...exercisesPerWord.map((e) => e.exercises.length),
    );
    const orderedExercises: ExerciseType[] = [];

    for (let round = 0; round < maxExercisesPerWord; round++) {
      const roundExercises: ExerciseType[] = [];
      for (const entry of exercisesPerWord) {
        if (round < entry.exercises.length) {
          roundExercises.push(entry.exercises[round]);
        }
      }
      orderedExercises.push(...shuffle(roundExercises));
    }

    return c.json({ exercises: orderedExercises });
  },
);

// POST /learn/complete
learn.post(
  "/complete",
  zValidator("json", CompleteLessonRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const userId = c.get("userId") as number;
    const { results } = c.req.valid("json");

    // Run everything in a transaction
    const response = await db.transaction(async (tx) => {
      // 1. Insert all exercise results
      await tx.insert(exerciseResults).values(
        results.map((r) => ({
          userId,
          wordId: r.word_id,
          exerciseType: r.exercise_type,
          isCorrect: r.is_correct,
          answerGiven: r.answer_given,
          timeSpentMs: r.time_spent_ms ?? null,
        })),
      );

      // 2. Group by word_id and count errors
      const wordErrors = new Map<number, number>();
      for (const r of results) {
        if (!r.is_correct) {
          wordErrors.set(r.word_id, (wordErrors.get(r.word_id) ?? 0) + 1);
        } else if (!wordErrors.has(r.word_id)) {
          wordErrors.set(r.word_id, 0);
        }
      }

      // 3. Process each word
      const wordIds = [...wordErrors.keys()];

      // Fetch current progress for all words
      const existingProgress = await tx
        .select()
        .from(userProgress)
        .where(
          and(
            eq(userProgress.userId, userId),
            sql`${userProgress.wordId} IN (${sql.join(
              wordIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          ),
        );

      const progressMap = new Map(
        existingProgress.map((p) => [p.wordId, p]),
      );

      // Fetch word data for response
      const wordRows = await tx
        .select()
        .from(words)
        .where(
          sql`${words.id} IN (${sql.join(
            wordIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );
      const wordMap = new Map(wordRows.map((w) => [w.id, w]));

      const wordResults: Array<{
        word_id: number;
        original: string;
        errors: number;
        previous_stage: string | null;
        new_stage: string;
      }> = [];

      let wordsAdvanced = 0;
      let wordsStayed = 0;
      let wordsRolledBack = 0;

      const now = new Date();

      for (const wordId of wordIds) {
        const errors = wordErrors.get(wordId) ?? 0;
        const existing = progressMap.get(wordId);
        const currentStage: SrsStage = existing
          ? (existing.srsStage as SrsStage)
          : "new";
        const previousStage: string | null = existing
          ? existing.srsStage
          : null;

        const { newStage, intervalMinutes } = computeProgression(
          currentStage,
          errors,
        );

        const nextReviewAt =
          intervalMinutes > 0
            ? new Date(now.getTime() + intervalMinutes * 60 * 1000)
            : now;

        if (existing) {
          await tx
            .update(userProgress)
            .set({
              srsStage: newStage,
              nextReviewAt,
              lastReviewedAt: now,
            })
            .where(eq(userProgress.id, existing.id));
        } else {
          await tx.insert(userProgress).values({
            userId,
            wordId,
            srsStage: newStage,
            nextReviewAt,
            lastReviewedAt: now,
          });
        }

        const word = wordMap.get(wordId);
        wordResults.push({
          word_id: wordId,
          original: word?.original ?? "",
          errors,
          previous_stage: previousStage,
          new_stage: newStage,
        });

        if (errors === 0) wordsAdvanced++;
        else if (errors === 1) wordsStayed++;
        else wordsRolledBack++;
      }

      const correct = results.filter((r) => r.is_correct).length;
      const incorrect = results.filter((r) => !r.is_correct).length;

      return {
        words: wordResults,
        summary: {
          total_exercises: results.length,
          correct,
          incorrect,
          words_advanced: wordsAdvanced,
          words_stayed: wordsStayed,
          words_rolled_back: wordsRolledBack,
        },
      };
    });

    return c.json(response);
  },
);

export { learn };
