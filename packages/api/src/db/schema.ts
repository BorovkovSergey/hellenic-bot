import {
  pgTable,
  serial,
  bigint,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const srsStageEnum = pgEnum("srs_stage", [
  "new",
  "stage_1",
  "stage_2",
  "stage_3",
  "stage_4",
  "learned",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).unique().notNull(),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }),
  username: varchar("username", { length: 255 }),
  languageCode: varchar("language_code", { length: 10 }),
  displayLanguage: varchar("display_language", { length: 10 })
    .notNull()
    .default("en"),
  wordsPerLesson: integer("words_per_lesson").notNull().default(5),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const words = pgTable("words", {
  id: serial("id").primaryKey(),
  original: varchar("original", { length: 255 }).unique().notNull(),
  transcription: varchar("transcription", { length: 255 }),
  translations: jsonb("translations").notNull().$type<Record<string, string>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userProgress = pgTable(
  "user_progress",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wordId: integer("word_id")
      .notNull()
      .references(() => words.id, { onDelete: "cascade" }),
    srsStage: srsStageEnum("srs_stage").notNull().default("new"),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_progress_user_word_idx").on(table.userId, table.wordId),
    index("user_progress_review_idx").on(
      table.userId,
      table.srsStage,
      table.nextReviewAt,
    ),
  ],
);

export const exerciseResults = pgTable(
  "exercise_results",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wordId: integer("word_id")
      .notNull()
      .references(() => words.id, { onDelete: "cascade" }),
    exerciseType: varchar("exercise_type", { length: 50 }).notNull(),
    isCorrect: boolean("is_correct").notNull(),
    answerGiven: varchar("answer_given", { length: 500 }),
    timeSpentMs: integer("time_spent_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("exercise_results_user_id_idx").on(table.userId, table.createdAt),
    index("exercise_results_word_id_idx").on(table.wordId),
  ],
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  progress: many(userProgress),
  exerciseResults: many(exerciseResults),
}));

export const wordsRelations = relations(words, ({ many }) => ({
  progress: many(userProgress),
  exerciseResults: many(exerciseResults),
}));

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  user: one(users, { fields: [userProgress.userId], references: [users.id] }),
  word: one(words, { fields: [userProgress.wordId], references: [words.id] }),
}));

export const exerciseResultsRelations = relations(
  exerciseResults,
  ({ one }) => ({
    user: one(users, {
      fields: [exerciseResults.userId],
      references: [users.id],
    }),
    word: one(words, {
      fields: [exerciseResults.wordId],
      references: [words.id],
    }),
  }),
);
