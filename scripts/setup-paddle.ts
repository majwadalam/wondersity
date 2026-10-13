// Sets up Paddle billing for Wondersity: the Pro product, its monthly and
// yearly prices (lib/plans.ts PRICES), the webhook destination for
// /api/billing/webhook and a client-side token for Paddle.js, then writes the
// values the app reads into .env.local. Safe to run again: it finds what it
// made before (by custom_data.app) instead of making it twice.
//
//   PADDLE_API_KEY=pdl_live_apikey_… NEXT_PUBLIC_SITE_URL=https://… \
//     node --env-file=.env.local --import tsx scripts/setup-paddle.ts
//
// The key's prefix picks the environment (pdl_sdbx_ sandbox, pdl_live_
// production). It needs permission to read and write products, prices,
// notification settings and client tokens. Secrets are written to the env
// file, never printed.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const APP = "wondersity";
const ENV_FILE = process.argv.find((a) => a.startsWith("--env-file="))?.slice(11) ?? ".env.local";

const key = process.env.PADDLE_API_KEY;
if (!key) {
  console.error("Set PADDLE_API_KEY (Paddle → Developer tools → Authentication → API keys).");
  process.exit(1);
}
const live = key.startsWith("pdl_live_") || (!key.startsWith("pdl_sdbx_") && process.env.NEXT_PUBLIC_PADDLE_ENV === "production");
const base = live ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
if (!/^https:\/\//.test(site)) {
  console.error("Set NEXT_PUBLIC_SITE_URL to the public https address; Paddle sends webhooks there.");
  process.exit(1);
}

const PLANS = [
  { plan: "monthly", name: "Wondersity Pro, monthly", amount: "1999", interval: "month" },
  { plan: "yearly", name: "Wondersity Pro, yearly", amount: "11999", interval: "year" },
] as const;

const EVENTS = [
  "subscription.created",
  "subscription.activated",
  "subscription.updated",
  "subscription.trialing",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "subscription.canceled",
];

type Entity = { id: string; status?: string; custom_data?: Record<string, string> | null; [k: string]: unknown };

async function paddle<T = Entity>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const e = json?.error;
    throw new Error(`Paddle ${method} ${path} ${response.status}: ${e?.code ?? ""} ${e?.detail ?? ""}`.trim());
  }
  return json.data as T;
}

/** Every page of a list endpoint. */
async function list(path: string): Promise<Entity[]> {
  const out: Entity[] = [];
  let next: string | null = `${base}${path}${path.includes("?") ? "&" : "?"}per_page=200`;
  while (next) {
    const response: Response = await fetch(next, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000) });
    const json = await response.json();
    if (!response.ok) throw new Error(`Paddle GET ${path} ${response.status}: ${json?.error?.code ?? ""} ${json?.error?.detail ?? ""}`);
    out.push(...json.data);
    next = json.meta?.pagination?.has_more ? json.meta.pagination.next : null;
  }
  return out;
}

async function product() {
  const found = (await list("/products?status=active")).find((p) => p.custom_data?.app === APP);
  if (found) return { id: found.id, made: false };
  const made = await paddle("POST", "/products", {
    name: "Wondersity Pro",
    description: "Every lesson of every course, with painted scenes and voiced guides.",
    tax_category: "standard",
    custom_data: { app: APP },
  });
  return { id: made.id, made: true };
}

async function price(productId: string, p: (typeof PLANS)[number]) {
  const found = (await list(`/prices?status=active&product_id=${productId}`)).find(
    (x) => x.custom_data?.app === APP && x.custom_data?.plan === p.plan,
  );
  if (found) {
    const unit = (found.unit_price as { amount: string; currency_code: string }) ?? {};
    if (unit.amount !== p.amount || unit.currency_code !== "USD") {
      console.warn(`  ! ${p.plan} price ${found.id} is ${unit.amount} ${unit.currency_code}, not ${p.amount} USD; left as it is.`);
    }
    return { id: found.id, made: false };
  }
  const made = await paddle("POST", "/prices", {
    product_id: productId,
    name: p.name,
    description: p.name,
    unit_price: { amount: p.amount, currency_code: "USD" },
    billing_cycle: { interval: p.interval, frequency: 1 },
    quantity: { minimum: 1, maximum: 1 },
    tax_mode: "account_setting",
    custom_data: { app: APP, plan: p.plan },
  });
  return { id: made.id, made: true };
}

async function webhook() {
  const destination = `${site}/api/billing/webhook`;
  const found = (await list("/notification-settings")).find((n) => n.destination === destination);
  if (found) {
    const subscribed = new Set(((found.subscribed_events as { name: string }[]) ?? []).map((e) => e.name));
    const missing = EVENTS.filter((e) => !subscribed.has(e));
    if (missing.length || !found.active) {
      await paddle("PATCH", `/notification-settings/${found.id}`, { active: true, subscribed_events: [...new Set([...subscribed, ...EVENTS])] });
    }
    return { id: found.id, secret: found.endpoint_secret_key as string, made: false };
  }
  const made = await paddle("POST", "/notification-settings", {
    description: "Wondersity subscriptions",
    destination,
    type: "url",
    subscribed_events: EVENTS,
    api_version: 1,
    include_sensitive_fields: false,
  });
  return { id: made.id, secret: made.endpoint_secret_key as string, made: true };
}

async function clientToken() {
  if (process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN) return { token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN, made: false };
  try {
    const made = await paddle("POST", "/client-tokens", { name: "Wondersity web", description: "Paddle.js checkout on the site" });
    return { token: made.token as string, made: true };
  } catch (error) {
    console.warn(`  ! Couldn't make a client-side token (${(error as Error).message}).`);
    console.warn("    Make one in Paddle → Developer tools → Authentication → Client-side tokens and set NEXT_PUBLIC_PADDLE_CLIENT_TOKEN.");
    return { token: undefined, made: false };
  }
}

/** Sets each key in the env file, replacing an existing (or commented-out) line or appending. */
function writeEnv(values: Record<string, string | undefined>) {
  let text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  for (const [name, value] of Object.entries(values)) {
    if (!value) continue;
    const line = `${name}=${value}`;
    const pattern = new RegExp(`^#?\\s*${name}=.*$`, "m");
    text = pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\n?$/, "\n")}${line}\n`;
  }
  writeFileSync(ENV_FILE, text, { mode: 0o600 });
}

async function main() {
  console.log(`Paddle ${live ? "production" : "sandbox"} — site ${site}`);
  const prod = await product();
  console.log(`  product ${prod.id} ${prod.made ? "(created)" : "(exists)"}`);
  const prices: Record<string, string> = {};
  for (const p of PLANS) {
    const r = await price(prod.id, p);
    prices[p.plan] = r.id;
    console.log(`  ${p.plan} price ${r.id} ${r.made ? "(created)" : "(exists)"}`);
  }
  const hook = await webhook();
  console.log(`  webhook ${hook.id} → ${site}/api/billing/webhook ${hook.made ? "(created)" : "(exists)"}`);
  const client = await clientToken();
  if (client.token) console.log(`  client-side token ${client.made ? "(created)" : "(already set)"}`);

  writeEnv({
    NEXT_PUBLIC_PADDLE_ENV: live ? "production" : "sandbox",
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: client.token,
    NEXT_PUBLIC_PADDLE_PRICE_MONTHLY: prices.monthly,
    NEXT_PUBLIC_PADDLE_PRICE_YEARLY: prices.yearly,
    PADDLE_API_KEY: key,
    PADDLE_WEBHOOK_SECRET: hook.secret,
  });
  console.log(`\nWrote the Paddle values to ${ENV_FILE}. Copy the same ones into the production environment.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
