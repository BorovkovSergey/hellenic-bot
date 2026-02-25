import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { SignJWT } from "jose";
import { createHmac } from "crypto";
import { AuthValidateRequestSchema } from "@hellenic-bot/shared";
import { upsertUser } from "./users.js";
import { db } from "../db/index.js";
import { AppError } from "../middleware/error.js";

const auth = new Hono();

function validateInitData(initData: string, botToken: string): Record<string, string> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw new AppError(401, "UNAUTHORIZED", "Missing hash in initData");
  }

  params.delete("hash");

  const entries = Array.from(params.entries());
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const computedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid initData signature");
  }

  const result: Record<string, string> = {};
  for (const [k, v] of entries) {
    result[k] = v;
  }
  return result;
}

auth.post(
  "/validate",
  zValidator("json", AuthValidateRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing or malformed init_data field",
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const { init_data } = c.req.valid("json");
    const botToken = process.env.BOT_TOKEN!;

    const data = validateInitData(init_data, botToken);

    const userData = JSON.parse(data.user);

    const user = await upsertUser(db, {
      telegram_id: userData.id,
      first_name: userData.first_name,
      last_name: userData.last_name,
      username: userData.username,
      language_code: userData.language_code,
    });

    const secret = new TextEncoder().encode(botToken);
    const token = await new SignJWT({
      sub: String(user.id),
      tid: user.telegram_id,
    } as Record<string, unknown>)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(secret);

    return c.json({ token, user });
  },
);

export { auth };
