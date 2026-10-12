import { NextResponse } from "next/server";
import { checkTables } from "@/lib/db";
import { env } from "@/lib/env";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/requestGuards";

// Diagnoses a deployment: is each setting present and clean, can we reach
// Supabase and read every table, and does OpenRouter accept the key?
// Reports status only, never the values.

const LIMIT_PER_IP = 10;
const LIMIT_WINDOW_MS = 60 * 1000;
const VARS = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limit = rateLimit(`health:${clientIp(request)}`, LIMIT_PER_IP, LIMIT_WINDOW_MS);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const settings: Record<string, string> = {};
  for (const name of VARS) {
    const raw = process.env[name];
    settings[name] = !raw?.trim()
      ? name === "OPENROUTER_MODEL"
        ? "not set (using default)"
        : "MISSING"
      : raw !== raw.trim()
        ? "set (had stray spaces/newlines, trimmed)"
        : "set";
  }

  let database: Record<string, string> | string;
  try {
    const url = env("NEXT_PUBLIC_SUPABASE_URL");
    if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
      database = "NEXT_PUBLIC_SUPABASE_URL doesn't look like https://<project>.supabase.co";
    } else {
      database = await checkTables();
    }
  } catch (e) {
    database = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  let openrouter: string;
  const key = env("OPENROUTER_API_KEY");
  if (!key) {
    openrouter = "no key";
  } else {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/key", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 401 || res.status === 403) {
        openrouter = "key rejected";
      } else if (!res.ok) {
        openrouter = `unexpected response ${res.status}`;
      } else {
        const { data } = await res.json();
        const remaining = data?.limit_remaining;
        openrouter = typeof remaining === "number" && remaining <= 0 ? "key ok, but no credits left" : "ok";
      }
    } catch (e) {
      openrouter = `unreachable: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const dbOk = typeof database === "object" && Object.values(database).every((v) => v === "ok");
  const ok = dbOk && openrouter === "ok" && !Object.values(settings).includes("MISSING");
  return NextResponse.json(
    { ok, settings, database, openrouter, model: env("OPENROUTER_MODEL") ?? "deepseek/deepseek-v4.1-flash" },
    { status: ok ? 200 : 503 }
  );
}
