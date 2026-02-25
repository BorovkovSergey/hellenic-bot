import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { upsertUser } from "../api.js";

const WELCOME_MESSAGES = {
  en: (name: string) =>
    `Hi, ${name}! 👋\n\nLearn Greek vocabulary with spaced repetition.\n\nTap the button below to get started.`,
  ru: (name: string) =>
    `Привет, ${name}! 👋\n\nУчи греческие слова с помощью интервального повторения.\n\nНажми кнопку ниже, чтобы начать.`,
};

const BUTTON_LABELS = {
  en: "🎓 Open App",
  ru: "🎓 Открыть",
};

function getLang(code?: string): "en" | "ru" {
  return code === "ru" ? "ru" : "en";
}

export async function handleStart(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  const webappUrl = process.env.WEBAPP_URL!;
  let lang: "en" | "ru";

  const user = await upsertUser({
    telegram_id: from.id,
    first_name: from.first_name,
    last_name: from.last_name,
    username: from.username,
    language_code: from.language_code,
  });

  if (user) {
    lang = user.display_language === "ru" ? "ru" : "en";
  } else {
    lang = getLang(from.language_code);
  }

  const message = WELCOME_MESSAGES[lang](from.first_name);
  const keyboard = new InlineKeyboard().webApp(
    BUTTON_LABELS[lang],
    webappUrl,
  );

  await ctx.reply(message, { reply_markup: keyboard });
}
