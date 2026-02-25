import { Bot } from "grammy";
import { handleStart } from "./handlers/start.js";
import { handleFallback } from "./handlers/fallback.js";

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("BOT_TOKEN is required");
  process.exit(1);
}

const bot = new Bot(token);

// Register handlers (order matters)
bot.command("start", handleStart);
bot.on("message", handleFallback);

// Start polling
bot.start({
  onStart: () => console.log("Bot started"),
});

// Graceful shutdown
const shutdown = () => {
  console.log("Shutting down bot...");
  bot.stop();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
