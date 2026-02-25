import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorHandler(err: Error, c: Context) {
  console.error("Unhandled error:", err);

  if (err instanceof AppError) {
    return c.json(
      { error: { code: err.code, message: err.message } },
      err.statusCode as ContentfulStatusCode,
    );
  }

  return c.json(
    { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
    500 as ContentfulStatusCode,
  );
}
