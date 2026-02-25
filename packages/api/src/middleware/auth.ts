import type { Context, Next } from "hono";
import { jwtVerify } from "jose";
import type { Env } from "../types.js";

const PUBLIC_PATHS = ["/health"];
const NO_AUTH_PREFIXES = ["/internal/"];

function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.includes(path)) return true;
  if (path === "/auth/validate") return true;
  for (const prefix of NO_AUTH_PREFIXES) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

export async function authMiddleware(c: Context<Env>, next: Next) {
  if (isPublicPath(c.req.path)) {
    return next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Missing or invalid token" } },
      401,
    );
  }

  const token = authHeader.slice(7);
  const secret = new TextEncoder().encode(process.env.BOT_TOKEN!);

  try {
    const { payload } = await jwtVerify(token, secret);
    c.set("userId", Number(payload.sub));
    c.set("telegramId", payload.tid as number);
  } catch {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } },
      401,
    );
  }

  return next();
}
