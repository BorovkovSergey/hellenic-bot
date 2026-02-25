import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./db/index.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { auth } from "./routes/auth.js";
import { usersRoute, internal } from "./routes/users.js";
import { learn } from "./routes/learn.js";
import type { Env } from "./types.js";

const app = new Hono<Env>();

// Error handler
app.onError(errorHandler);

// Auth middleware
app.use("*", authMiddleware);

// Routes
app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/auth", auth);
app.route("/internal", internal);
app.route("/users", usersRoute);
app.route("/learn", learn);

// Export type for Hono RPC
export type AppType = typeof app;

const port = parseInt(process.env.PORT ?? "3000", 10);

async function main() {
  // Run migrations on startup
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied successfully");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }

  serve({ fetch: app.fetch, port }, () => {
    console.log(`API server running on port ${port}`);
  });
}

main();
