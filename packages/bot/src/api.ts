const API_URL = process.env.API_URL ?? "http://localhost:3000";

export async function upsertUser(data: {
  telegram_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}): Promise<{ display_language: string } | null> {
  try {
    const res = await fetch(`${API_URL}/internal/users/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      return await res.json();
    }
    console.error("User upsert failed:", res.status, await res.text());
    return null;
  } catch (err) {
    console.error("User upsert error:", err);
    return null;
  }
}
