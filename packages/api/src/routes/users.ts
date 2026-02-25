import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import {
  UpsertUserRequestSchema,
  UpdateSettingsRequestSchema,
  type User,
} from "@hellenic-bot/shared";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { AppError } from "../middleware/error.js";
import type { Env } from "../types.js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const SUPPORTED_LANGUAGES = ["en", "ru"];

function toUserResponse(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    telegram_id: row.telegramId,
    first_name: row.firstName,
    last_name: row.lastName,
    username: row.username,
    display_language: row.displayLanguage,
    words_per_lesson: row.wordsPerLesson,
  };
}

export async function upsertUser(
  database: PostgresJsDatabase<any>,
  data: {
    telegram_id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  },
): Promise<User> {
  const displayLang =
    data.language_code && SUPPORTED_LANGUAGES.includes(data.language_code)
      ? data.language_code
      : "en";

  const [row] = await database
    .insert(users)
    .values({
      telegramId: data.telegram_id,
      firstName: data.first_name,
      lastName: data.last_name ?? null,
      username: data.username ?? null,
      languageCode: data.language_code ?? null,
      displayLanguage: displayLang,
    })
    .onConflictDoUpdate({
      target: users.telegramId,
      set: {
        firstName: data.first_name,
        lastName: data.last_name ?? null,
        username: data.username ?? null,
        languageCode: data.language_code ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return toUserResponse(row);
}

const usersRoute = new Hono<Env>();

// Internal upsert
const internal = new Hono();
internal.post(
  "/users/upsert",
  zValidator("json", UpsertUserRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: result.error.message } },
        400,
      );
    }
  }),
  async (c) => {
    const data = c.req.valid("json");
    const user = await upsertUser(db, data);
    return c.json(user);
  },
);

// GET /users/me
usersRoute.get("/me", async (c) => {
  const userId = c.get("userId") as number;
  const [row] = await db.select().from(users).where(eq(users.id, userId));
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "User not found");
  }
  return c.json(toUserResponse(row));
});

// PATCH /users/me/settings
usersRoute.patch(
  "/me/settings",
  zValidator("json", UpdateSettingsRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: result.error.issues[0]?.message ?? "Invalid settings values",
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const userId = c.get("userId") as number;
    const data = c.req.valid("json");

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (data.display_language !== undefined) {
      updateFields.displayLanguage = data.display_language;
    }
    if (data.words_per_lesson !== undefined) {
      updateFields.wordsPerLesson = data.words_per_lesson;
    }

    const [row] = await db
      .update(users)
      .set(updateFields)
      .where(eq(users.id, userId))
      .returning();

    if (!row) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    return c.json(toUserResponse(row));
  },
);

export { usersRoute, internal };
