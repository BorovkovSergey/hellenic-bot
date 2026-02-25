import type { Context } from "grammy";

const FALLBACK_MESSAGES = {
  en: "Use the app to learn. Tap /start to open it.",
  ru: "Используй приложение для обучения. Нажми /start, чтобы открыть.",
};

export async function handleFallback(ctx: Context) {
  const lang = ctx.from?.language_code === "ru" ? "ru" : "en";
  await ctx.reply(FALLBACK_MESSAGES[lang]);
}
