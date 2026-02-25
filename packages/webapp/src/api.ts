import { hc } from "hono/client";
import type { AppType } from "@hellenic-bot/api";

let token: string | null = null;

export function setToken(t: string) {
  token = t;
}

export function getToken() {
  return token;
}

const baseUrl = import.meta.env.VITE_API_URL ?? "/api";

export const apiClient = hc<AppType>(baseUrl, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string>),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return fetch(input, { ...init, headers });
  },
});
