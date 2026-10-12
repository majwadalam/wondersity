// OpenRouter client. Two call shapes:
//  - callStructured: one prompt in, JSON matching a schema out (lesson writer).
//  - callWithTools:  a chat turn that may request tool calls (tutor agent).

import { AsyncLocalStorage } from "node:async_hooks";
import { env, requireEnv } from "./env";

// Measured on the same sample lessons (see HARNESS.md, "Choosing the models"):
// GPT-6.1 Sol wrote the best lessons, passed review on the first draft, and
// costs about $0.04 per lesson including review; Opus 5.5 cost 4-8 times as
// much without scoring higher, and cheaper writers rarely reached the bar.
const DEFAULT_MODEL = "openai/gpt-6.1-sol";
// The reviewer. Sol reviewing Sol is self-review, which misses a writer's own
// mistakes; arithmetic is therefore checked in code (factCheck.ts), and
// REVIEW_MODEL can point at a model from another family.
const DEFAULT_REVIEW_MODEL = "openai/gpt-6.1-sol";

/** The model that runs the tutor agent and writes lessons. */
export const writerModel = () => env("OPENROUTER_MODEL") ?? DEFAULT_MODEL;
/** The model that reviews lessons. */
export const reviewModel = () => env("REVIEW_MODEL") ?? DEFAULT_REVIEW_MODEL;

// OpenRouter serves the same model from several providers whose speed varies
// a lot (measured: 4s vs 8-26s for the same evaluator call). Prefer the
// fastest; it falls back to others if that one is down.
const PROVIDER_ROUTING = { sort: "throughput" };

/** How hard a reasoning model "thinks" before answering. Omit for the model default. */
export type ReasoningEffort = "low" | "medium" | "high";

// A single model call may not hang the request: abort after this long, or
// sooner if the caller's deadline is closer. Callers that write long outputs
// (a whole lesson) may ask for more; see lessonWriter.ts.
const MODEL_TIMEOUT_MS = 60_000;
// Don't start (or retry) a call with less time than this left.
const MIN_CALL_MS = 5_000;

/** Epoch ms by which the whole run must finish. */
export type Deadline = number;

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolDefinition = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

/** Tokens and dollars spent by the model calls inside one `withUsage` scope. */
export type Usage = { calls: number; promptTokens: number; completionTokens: number; cost: number; cachedTokens?: number };

// Scoped per run, so concurrent requests on one server don't mix their totals.
const usageScope = new AsyncLocalStorage<Usage>();

export const emptyUsage = (): Usage => ({ calls: 0, promptTokens: 0, completionTokens: 0, cost: 0 });

/**
 * Runs `fn` and totals what every model call inside it cost, as OpenRouter
 * reports it. Pass `usage` to keep the totals when `fn` throws.
 */
export async function withUsage<T>(fn: () => Promise<T>, usage = emptyUsage()): Promise<{ result: T; usage: Usage }> {
  const result = await usageScope.run(usage, fn);
  return { result, usage };
}

/** Adds one call's usage to the current withUsage scope (for calls made outside this client, e.g. images). */
export function recordUsage(
  u: { prompt_tokens?: number; completion_tokens?: number; cost?: number; prompt_tokens_details?: { cached_tokens?: number } } | undefined
) {
  const total = usageScope.getStore();
  if (!total || !u) return;
  total.calls++;
  total.promptTokens += u.prompt_tokens ?? 0;
  total.completionTokens += u.completion_tokens ?? 0;
  total.cost += u.cost ?? 0;
  // Prompt tokens the provider served from its cache (cheaper): the writing
  // guide opens every lesson call unchanged, so it should be cached.
  total.cachedTokens = (total.cachedTokens ?? 0) + (u.prompt_tokens_details?.cached_tokens ?? 0);
}

/** A web page a search-backed reply was given, as OpenRouter reports it. */
export type Source = { url: string; title: string; content: string };

type AssistantMessage = Extract<ChatMessage, { role: "assistant" }> & { sources?: Source[] };

// Providers occasionally stall or return 429/5xx. Retry those once; anything
// else (bad request, auth) fails immediately.
const MAX_ATTEMPTS = 2;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export class ModelHttpError extends Error {
  constructor(readonly status: number, body: string) {
    super(`OpenRouter ${status}: ${body}`);
  }
}

function isTransient(e: unknown) {
  if (e instanceof ModelHttpError) return RETRYABLE_STATUS.has(e.status);
  // fetch throws TimeoutError on our abort and TypeError on network failure.
  return e instanceof Error && (e.name === "TimeoutError" || e.name === "TypeError");
}

async function chat(
  body: Record<string, unknown>,
  deadline: Deadline,
  timeoutMs = MODEL_TIMEOUT_MS
): Promise<AssistantMessage> {
  for (let attempt = 1; ; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_CALL_MS) throw new Error("Out of time for another model call");
    try {
      return await chatOnce(body, Math.min(timeoutMs, remaining));
    } catch (e) {
      if (attempt >= MAX_ATTEMPTS || !isTransient(e)) throw e;
      console.warn(`Model call failed (${e instanceof Error ? e.message : e}); retrying`);
    }
  }
}

async function chatOnce(body: Record<string, unknown>, timeoutMs: number): Promise<AssistantMessage> {
  const apiKey = requireEnv("OPENROUTER_API_KEY");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: writerModel(),
      provider: PROVIDER_ROUTING,
      usage: { include: true },
      ...body,
    }),
  });

  if (!response.ok) {
    throw new ModelHttpError(response.status, await response.text());
  }

  const data = await response.json();
  recordUsage(data.usage);
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("Model returned no message");
  // Search results come back as url_citation annotations. The harness keeps
  // them so a reply's cited source can be checked against what was searched.
  const sources: Source[] = (message.annotations ?? [])
    .filter((a: { type?: string }) => a.type === "url_citation")
    .map((a: { url_citation: { url?: string; title?: string; content?: string } }) => ({
      url: a.url_citation.url ?? "",
      title: a.url_citation.title ?? "",
      content: a.url_citation.content ?? "",
    }))
    .filter((src: Source) => src.url);
  return { role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls, sources };
}

type StructuredOptions = {
  reasoningEffort?: ReasoningEffort;
  timeoutMs?: number;
  model?: string;
  /**
   * The most output tokens (including hidden reasoning) this call may use.
   * Without it, OpenRouter reserves the model's largest possible reply against
   * the key's credit while the call runs (about $1 for GPT-6.1 Sol), so a few
   * parallel calls fail with 402 "in-flight budget exhausted".
   */
  maxTokens?: number;
  /** OpenRouter's web search plugin: search before answering. */
  webSearch?: { maxResults?: number; engine?: string; includeDomains?: string[]; excludeDomains?: string[] };
};

/** Returns parsed JSON constrained by `schema`. Callers must still validate it. */
export async function callStructured(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  deadline: Deadline,
  options: StructuredOptions = {}
): Promise<unknown> {
  return (await structuredCall(system, user, schema, deadline, options)).data;
}

/**
 * Like callStructured, with web search on, and also returns the pages the
 * search found, so the caller can check which ones a reply relied on.
 */
export async function callStructuredWithSources(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  deadline: Deadline,
  options: StructuredOptions & { webSearch: NonNullable<StructuredOptions["webSearch"]> }
): Promise<{ data: unknown; sources: Source[] }> {
  return structuredCall(system, user, schema, deadline, options);
}

async function structuredCall(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  deadline: Deadline,
  { reasoningEffort, timeoutMs, model = writerModel(), webSearch, maxTokens }: StructuredOptions
): Promise<{ data: unknown; sources: Source[] }> {
  // Anthropic refuses our larger lesson schemas as constrained grammars ("compiled
  // grammar is too large"), so it gets the schema in the prompt and plain JSON
  // mode instead. Every reply is validated against the schema in code either way.
  const unconstrained = model.startsWith("anthropic/");
  const message = await chat({
    model,
    messages: [
      {
        role: "system",
        content: unconstrained ? `${system}\n\nReply with one JSON object matching this JSON Schema, and nothing else:\n${JSON.stringify(schema)}` : system,
      },
      { role: "user", content: user },
    ],
    response_format: unconstrained ? { type: "json_object" } : { type: "json_schema", json_schema: { name: "response", strict: true, schema } },
    ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
    ...(webSearch
      ? {
          plugins: [
            {
              id: "web",
              max_results: webSearch.maxResults ?? 5,
              // Exa is the default: it takes both domain lists (other engines take one).
              engine: webSearch.engine ?? "exa",
              ...(webSearch.includeDomains ? { include_domains: webSearch.includeDomains } : {}),
              ...(webSearch.excludeDomains ? { exclude_domains: webSearch.excludeDomains } : {}),
            },
          ],
        }
      : {}),
  }, deadline, timeoutMs);
  if (!message.content) throw new Error("Model returned no content");
  // An unconstrained reply may come wrapped in a ```json fence.
  return {
    data: JSON.parse(message.content.trim().replace(/^```(?:json)?\s*|\s*```$/g, "")),
    sources: message.sources ?? [],
  };
}

/** One agent turn: the model either answers in text or asks for tool calls. */
export async function callWithTools(
  messages: ChatMessage[],
  tools: ToolDefinition[],
  deadline: Deadline
): Promise<AssistantMessage> {
  // A turn is a short note or a tool call; the largest is a course plan (~3k tokens).
  return chat({ messages, tools, tool_choice: "auto", max_tokens: 8_000 }, deadline);
}

// Embeddings: a topic as 1536 numbers, so topics that mean the same thing
// ("Stoicism", "stoic philosophy") land close together. Used to match shared
// course plans (lib/planCache.ts). The table's column is sized for this model.
const EMBED_MODEL = "openai/text-embedding-3-small";
export const EMBED_DIMENSIONS = 1536;

/** The embedding of a short text. Throws on failure; callers treat that as "no match". */
export async function embed(text: string, timeoutMs = 15_000): Promise<number[]> {
  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Authorization: `Bearer ${requireEnv("OPENROUTER_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text, usage: { include: true } }),
  });
  if (!response.ok) throw new ModelHttpError(response.status, await response.text());
  const data = await response.json();
  recordUsage(data.usage);
  const vector: unknown = data.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== EMBED_DIMENSIONS || !vector.every((x) => typeof x === "number")) {
    throw new Error("Embedding came back in an unexpected shape");
  }
  return vector;
}
