import { z } from "zod";

// --- User ---

export const UserSchema = z.object({
  id: z.number(),
  telegram_id: z.number(),
  first_name: z.string(),
  last_name: z.string().nullable(),
  username: z.string().nullable(),
  display_language: z.string(),
  words_per_lesson: z.number(),
});

export type User = z.infer<typeof UserSchema>;

// --- Auth ---

export const AuthValidateRequestSchema = z.object({
  init_data: z.string().min(1),
});

export type AuthValidateRequest = z.infer<typeof AuthValidateRequestSchema>;

export const AuthValidateResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
});

export type AuthValidateResponse = z.infer<typeof AuthValidateResponseSchema>;

// --- User upsert (internal) ---

export const UpsertUserRequestSchema = z.object({
  telegram_id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
});

export type UpsertUserRequest = z.infer<typeof UpsertUserRequestSchema>;

// --- Settings ---

export const UpdateSettingsRequestSchema = z
  .object({
    display_language: z.enum(["en", "ru"]).optional(),
    words_per_lesson: z.number().int().min(1).max(20).optional(),
  })
  .refine((data) => data.display_language || data.words_per_lesson !== undefined, {
    message: "At least one field must be provided",
  });

export type UpdateSettingsRequest = z.infer<typeof UpdateSettingsRequestSchema>;

// --- Learn stats ---

export const LearnStatsResponseSchema = z.object({
  new_available: z.number(),
  continue_available: z.number(),
  review_available: z.number(),
  total_words: z.number(),
  learned_words: z.number(),
});

export type LearnStatsResponse = z.infer<typeof LearnStatsResponseSchema>;

// --- Start lesson ---

export const StartLessonRequestSchema = z.object({
  mode: z.enum(["new", "continue", "review"]),
});

export type StartLessonRequest = z.infer<typeof StartLessonRequestSchema>;

// --- Exercise schemas (discriminated union) ---

const FlashcardExerciseSchema = z.object({
  word_id: z.number(),
  exercise_type: z.literal("flashcard"),
  prompt: z.object({
    original: z.string(),
    transcription: z.string().optional(),
    notes: z.string().nullable(),
  }),
  answer: z.object({
    translation: z.string(),
  }),
});

const MultipleChoiceExerciseSchema = z.object({
  word_id: z.number(),
  exercise_type: z.literal("multiple_choice"),
  prompt: z.object({
    original: z.string(),
    transcription: z.string().optional(),
    notes: z.string().nullable(),
  }),
  options: z.array(z.string()).length(4),
  correct_index: z.literal(0),
});

const MultipleChoiceReverseExerciseSchema = z.object({
  word_id: z.number(),
  exercise_type: z.literal("multiple_choice_reverse"),
  prompt: z.object({
    translation: z.string(),
    notes: z.string().nullable(),
  }),
  options: z
    .array(
      z.object({
        original: z.string(),
        transcription: z.string().optional(),
      }),
    )
    .length(4),
  correct_index: z.literal(0),
});

const FillBlankExerciseSchema = z.object({
  word_id: z.number(),
  exercise_type: z.literal("fill_blank"),
  prompt: z.object({
    translation: z.string(),
    notes: z.string().nullable(),
  }),
  answer: z.object({
    original: z.string(),
  }),
});

const ScrambleExerciseSchema = z.object({
  word_id: z.number(),
  exercise_type: z.literal("scramble"),
  prompt: z.object({
    translation: z.string(),
    scrambled: z.array(z.array(z.string())),
    notes: z.string().nullable(),
  }),
  answer: z.object({
    original: z.string(),
  }),
});

export const ExerciseSchema = z.discriminatedUnion("exercise_type", [
  FlashcardExerciseSchema,
  MultipleChoiceExerciseSchema,
  MultipleChoiceReverseExerciseSchema,
  FillBlankExerciseSchema,
  ScrambleExerciseSchema,
]);

export type Exercise = z.infer<typeof ExerciseSchema>;

export const StartLessonResponseSchema = z.object({
  exercises: z.array(ExerciseSchema),
});

export type StartLessonResponse = z.infer<typeof StartLessonResponseSchema>;

// --- Complete lesson ---

export const ExerciseResultSchema = z.object({
  word_id: z.number(),
  exercise_type: z.enum([
    "flashcard",
    "multiple_choice",
    "multiple_choice_reverse",
    "fill_blank",
    "scramble",
  ]),
  is_correct: z.boolean(),
  answer_given: z.string().nullable(),
  time_spent_ms: z.number().int().min(0).optional(),
});

export type ExerciseResult = z.infer<typeof ExerciseResultSchema>;

export const CompleteLessonRequestSchema = z.object({
  results: z.array(ExerciseResultSchema).min(1),
});

export type CompleteLessonRequest = z.infer<typeof CompleteLessonRequestSchema>;

const WordResultSchema = z.object({
  word_id: z.number(),
  original: z.string(),
  errors: z.number(),
  previous_stage: z.string().nullable(),
  new_stage: z.string(),
});

const SummarySchema = z.object({
  total_exercises: z.number(),
  correct: z.number(),
  incorrect: z.number(),
  words_advanced: z.number(),
  words_stayed: z.number(),
  words_rolled_back: z.number(),
});

export const CompleteLessonResponseSchema = z.object({
  words: z.array(WordResultSchema),
  summary: SummarySchema,
});

export type CompleteLessonResponse = z.infer<typeof CompleteLessonResponseSchema>;

// --- Error ---

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
