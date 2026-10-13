import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { runLabel } from "./labels";

// Building blocks for the admin panel's server-rendered pages.

// ---------- Formatting ----------

export function usd(n: number) {
  if (n === 0) return "$0";
  if (Math.abs(n) < 0.01) return `$${n.toFixed(4)}`;
  if (Math.abs(n) < 100) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function duration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export function num(n: number) {
  return n.toLocaleString("en-US");
}

export function tokens(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

export function ago(iso: string | null | undefined) {
  if (!iso) return "–";
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function when(iso: string | null | undefined) {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }) + " UTC";
}

/** A timestamp shown as "3h ago", with the exact time on hover. */
export function Time({ iso }: { iso: string | null | undefined }) {
  return (
    <time dateTime={iso ?? undefined} title={when(iso)} className="whitespace-nowrap">
      {ago(iso)}
    </time>
  );
}

// ---------- Layout ----------

export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-3xl text-fg">{title}</h1>
        {sub && <p className="mt-1.5 text-[15px] text-muted">{sub}</p>}
      </div>
      {children}
    </header>
  );
}

export function Section({ title, sub, children, action }: { title: string; sub?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-fg">{title}</h2>
          {sub && <p className="text-sm text-muted">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-surface shadow-[0_1px_2px_rgba(10,37,64,0.04)] ring-1 ring-line ${className}`}>{children}</div>;
}

export type StatItem = { label: string; value: ReactNode; sub?: ReactNode; href?: string; icon?: LucideIcon; spark?: number[] };

/** A row of number tiles; each can carry an icon and a two-week mini chart. */
export function Stats({ items }: { items: StatItem[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line shadow-[0_1px_2px_rgba(10,37,64,0.04)] ring-1 ring-line md:grid-cols-4">
      {items.map((s) => {
        const Icon = s.icon;
        const body = (
          <>
            <dt className="flex items-center gap-2 text-[13px] font-medium text-muted">
              {Icon && (
                <span className="flex size-6 items-center justify-center rounded-md bg-accent-soft text-accent">
                  <Icon size={14} aria-hidden />
                </span>
              )}
              {s.label}
            </dt>
            <dd className="mt-3 flex items-end justify-between gap-3">
              <span className="text-[28px] leading-none font-semibold tracking-tight text-fg tabular-nums">{s.value}</span>
              {s.spark && <Spark values={s.spark} />}
            </dd>
            {s.sub && <dd className="mt-2 text-[13px] text-muted">{s.sub}</dd>}
          </>
        );
        return s.href ? (
          <Link key={s.label} href={s.href} className="bg-surface p-5 transition-colors hover:bg-canvas/70">
            {body}
          </Link>
        ) : (
          <div key={s.label} className="bg-surface p-5">
            {body}
          </div>
        );
      })}
    </dl>
  );
}

/** A tiny bar chart of recent days for a number tile: shape only, the tile states the number. */
function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values, 0);
  return (
    <span className="flex h-7 shrink-0 items-end gap-[2px]" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className={`w-[4px] rounded-[1px] ${i === values.length - 1 ? "bg-accent" : "bg-accent/35"}`}
          style={{ height: max && v ? `max(3px, ${(v / max) * 100}%)` : 2, opacity: v ? 1 : 0.4 }}
        />
      ))}
    </span>
  );
}

/** A chart in a card: the title, the period's headline number and a link, then the chart. */
export function ChartCard({ title, total, sub, href, children }: { title: string; total?: ReactNode; sub?: ReactNode; href?: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-medium text-muted">{title}</h2>
          {total !== undefined && <p className="mt-1.5 text-[24px] leading-none font-semibold tracking-tight text-fg tabular-nums">{total}</p>}
          {sub && <p className="mt-1.5 text-[13px] text-muted">{sub}</p>}
        </div>
        {href && (
          <Link href={href} className="shrink-0 rounded-full px-2.5 py-1 text-[13px] font-medium text-accent hover:bg-accent-soft">
            Details →
          </Link>
        )}
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

// ---------- Tables ----------

export type Column<T> = { label: string; cell: (row: T) => ReactNode; align?: "right"; className?: string };

export function Table<T>({ rows, columns, empty = "Nothing yet.", rowKey }: { rows: T[]; columns: Column<T>[]; empty?: string; rowKey: (row: T) => string | number }) {
  if (!rows.length) return <Card className="p-8 text-center text-sm text-muted">{empty}</Card>;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[12px] uppercase tracking-wide text-muted">
            {columns.map((c) => (
              <th key={c.label} className={`px-4 py-2.5 font-medium whitespace-nowrap ${c.align === "right" ? "text-right" : ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={rowKey(r)} className="hover:bg-canvas/60">
              {columns.map((c) => (
                <td key={c.label} className={`px-4 py-2.5 align-top text-fg ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.className ?? ""}`}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-accent hover:underline">
      {children}
    </Link>
  );
}

const TONES = {
  good: "bg-good/10 text-[#0e7a36]",
  bad: "bg-bad/10 text-bad",
  warn: "bg-warn/20 text-[#8a4b00]",
  accent: "bg-accent-soft text-accent",
  muted: "bg-canvas text-muted ring-1 ring-line",
} as const;

export function Badge({ tone = "muted", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap ${TONES[tone]}`}>{children}</span>;
}

/** What a run did, in plain words, with a dot for how it went; hover for more. */
export function RunStatus({ kind, ok, outcome }: { kind: string; ok: boolean; outcome: string | null }) {
  const l = runLabel(kind, outcome, ok);
  const dot = !ok ? "bg-bad" : outcome === "resumed" ? "bg-line-strong" : "bg-good";
  return (
    <span title={l.about} className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={`size-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      {l.name}
    </span>
  );
}

/** A short explanation under a heading or above a table. */
export function Explain({ children }: { children: ReactNode }) {
  return <p className="max-w-3xl text-[14px] leading-relaxed text-muted">{children}</p>;
}

export type Attention = { tone: "bad" | "warn"; title: string; detail: ReactNode; href?: string };

/** Things that need a look, or a calm "all clear". */
export function NeedsAttention({ items }: { items: Attention[] }) {
  if (!items.length) {
    return (
      <Card className="flex items-center gap-3 p-4 text-[15px]">
        <span className="size-2.5 rounded-full bg-good" aria-hidden />
        <span className="text-fg">Nothing needs attention.</span>
      </Card>
    );
  }
  return (
    <Card className="divide-y divide-line">
      {items.map((i) => {
        const body = (
          <div className="flex items-start gap-3 p-4">
            <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${i.tone === "bad" ? "bg-bad" : "bg-warn"}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-fg">{i.title}</p>
              <p className="mt-0.5 text-[14px] text-muted">{i.detail}</p>
            </div>
            {i.href && <span className="text-sm font-medium text-accent">Look →</span>}
          </div>
        );
        return i.href ? (
          <Link key={i.title} href={i.href} className="block hover:bg-canvas/60">
            {body}
          </Link>
        ) : (
          <div key={i.title}>{body}</div>
        );
      })}
    </Card>
  );
}

/** Filter pills that set one search param, keeping the others. */
export function Filters({ base, params, name, options }: { base: string; params: Record<string, string | undefined>; name: string; options: [string | undefined, string][] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([value, label]) => {
        const next = new URLSearchParams(Object.entries({ ...params, [name]: value, page: undefined }).filter((e): e is [string, string] => !!e[1]));
        const active = params[name] === value;
        return (
          <Link
            key={label}
            href={`${base}${next.size ? `?${next}` : ""}`}
            className={`rounded-full px-3 py-1 text-[13px] font-medium ring-1 transition-colors ${active ? "bg-fg text-white ring-fg" : "bg-surface text-muted ring-line hover:text-fg"}`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export function Pager({ base, params, page, total, perPage }: { base: string; params: Record<string, string | undefined>; page: number; total: number; perPage: number }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...params, page: p ? String(p) : undefined }).filter((e): e is [string, string] => !!e[1]));
    return `${base}${q.size ? `?${q}` : ""}`;
  };
  return (
    <nav className="mt-4 flex items-center justify-between text-sm text-muted">
      <span>
        Page {page + 1} of {pages} · {num(total)} in all
      </span>
      <span className="flex gap-2">
        {page > 0 && <A href={href(page - 1)}>← Newer</A>}
        {page < pages - 1 && <A href={href(page + 1)}>Older →</A>}
      </span>
    </nav>
  );
}

// ---------- Charts ----------

/** A round step for chart gridlines, so the axis reads $0.50, $1, $1.50 … or 2, 4, 6 … */
function niceStep(max: number, whole: boolean) {
  const raw = max / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  return whole ? Math.max(1, Math.round(step)) : step;
}

/** The fewest days a day chart shows. */
const MIN_DAYS = 7;

export type Format = "usd" | "count";
export const fmt = (v: number, f: Format) => (f === "usd" ? usd(v) : num(Math.round(v * 10) / 10));

/**
 * One value per day as bars: a single series, so no legend (the section title
 * names it). Gridlines carry labelled values; each day's column is its hover
 * target and shows the day and its value.
 */
export function DayChart({ days: all, format = "count", noun = "", bare = false }: { days: { day: string; value: number }[]; format?: Format; noun?: string; bare?: boolean }) {
  // Start at the first day with anything on it (but show at least a week), so
  // a new app isn't a chart of empty days with two bars at the right edge.
  const first = all.findIndex((d) => d.value > 0);
  const days = all.slice(Math.max(0, Math.min(first < 0 ? all.length : first, all.length - MIN_DAYS)));
  const peak = Math.max(...days.map((d) => d.value), 0);
  const step = niceStep(peak || 1, format === "count");
  const top = Math.max(step, Math.ceil(peak / step) * step);
  const lines = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const label = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const last = days.length - 1;
  // Selective direct labels: the highest day and today, not every bar.
  const peakAt = days.findIndex((d) => d.value === peak && peak > 0);
  const labelled = new Set([peakAt, days[last].value > 0 ? last : -1]);
  const every = Math.ceil(days.length / 10);

  const chart = (
    <div className="grid grid-cols-[auto_1fr] gap-x-3">
      {/* The value axis: as wide as its widest label, no wider. */}
      <div className="relative h-44 text-right text-[11px] text-muted/80 tabular-nums">
        <span className="invisible block h-0 overflow-hidden" aria-hidden>
          {fmt(top, format)}
        </span>
        {lines.map((v) => (
          <span key={v} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: `${(v / top) * 100}%` }}>
            {fmt(v, format)}
          </span>
        ))}
      </div>
      <div className="relative h-44">
        {lines.map((v) => (
          <div key={v} className={`absolute inset-x-0 border-t ${v === 0 ? "border-line-strong" : "border-dashed border-line"}`} style={{ bottom: `${(v / top) * 100}%` }} />
        ))}
        <div className="absolute inset-0 flex items-end gap-1.5" role="img" aria-label={`${noun} per day`}>
          {days.map((d, i) => (
            <div key={d.day} className="group relative flex h-full flex-1 items-end justify-center">
              {d.value > 0 ? (
                <div
                  className={`relative w-full max-w-9 rounded-t-md transition-colors ${i === last ? "bg-accent" : "bg-accent/55"} group-hover:bg-accent-strong`}
                  style={{ height: `max(3px, ${(d.value / top) * 100}%)` }}
                >
                  {labelled.has(i) && (
                    <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-[11px] font-semibold whitespace-nowrap text-fg tabular-nums">{fmt(d.value, format)}</span>
                  )}
                </div>
              ) : (
                <div className="h-[3px] w-full max-w-9 rounded-full bg-line" />
              )}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg bg-fg px-2.5 py-1.5 text-[12px] whitespace-nowrap text-white shadow-md group-hover:block">
                <div className="font-medium">{label(d.day)}</div>
                <div className="tabular-nums">
                  {fmt(d.value, format)} {noun}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Day labels under their bars: every day for a week or so, else every few days. */}
      <div />
      <div className="mt-2.5 flex gap-1.5 text-[11px] text-muted/80 tabular-nums">
        {days.map((d, i) => {
          const date = new Date(`${d.day}T00:00:00Z`);
          const text = i === last ? "Today" : i === 0 || date.getUTCDate() === 1 ? label(d.day) : String(date.getUTCDate());
          return (
            <span key={d.day} className={`flex-1 text-center whitespace-nowrap ${i === last ? "font-medium text-fg" : ""}`}>
              {(last - i) % every === 0 ? text : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
  return bare ? chart : <Card className="px-5 pt-6 pb-4">{chart}</Card>;
}

/**
 * Horizontal bars for comparing a few named things (a single series), each
 * labelled with its name and value, so no legend or hover is needed to read it.
 */
export function HBars({ rows, format = "usd" }: { rows: { label: string; value: number; note?: string }[]; format?: Format }) {
  if (!rows.length) return <Card className="p-8 text-center text-sm text-muted">Nothing in this period.</Card>;
  const max = Math.max(...rows.map((r) => r.value), 0);
  return (
    <Card className="space-y-3 p-5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(120px,220px)_1fr_80px] items-center gap-3 text-[14px]" title={r.note}>
          <span className="truncate text-fg">{r.label}</span>
          <div className="h-3 rounded-r-[4px] bg-canvas">
            <div className="h-full rounded-r-[4px] bg-accent" style={{ width: `${max ? Math.max(1, (r.value / max) * 100) : 0}%` }} />
          </div>
          <span className="text-right text-muted tabular-nums">{fmt(r.value, format)}</span>
        </div>
      ))}
    </Card>
  );
}

/** Tabs that set one search param (and reset the page), as links. */
export function Tabs({ base, params, name = "tab", tabs }: { base: string; params: Record<string, string | undefined>; name?: string; tabs: { value: string | undefined; label: string; count?: number }[] }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const q = new URLSearchParams(Object.entries({ ...params, [name]: t.value, page: undefined }).filter((e): e is [string, string] => !!e[1]));
        const active = params[name] === t.value;
        return (
          <Link
            key={t.label}
            href={`${base}${q.size ? `?${q}` : ""}`}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[14px] font-medium transition-colors ${
              active ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`rounded-full px-1.5 text-[12px] tabular-nums ${active ? "bg-accent-soft text-accent" : "bg-canvas text-muted"}`}>{num(t.count)}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** One page of rows already in memory. */
export function paginate<T>(rows: T[], page: number, perPage = 25) {
  const last = Math.max(0, Math.ceil(rows.length / perPage) - 1);
  const p = Math.min(Math.max(0, page), last);
  return { rows: rows.slice(p * perPage, p * perPage + perPage), page: p, total: rows.length, perPage };
}

/** A page number from a search param. */
export const pageParam = (v: unknown) => Math.max(0, Number(typeof v === "string" ? v : 0) || 0);

/** A horizontal share bar for one row of a breakdown table. */
export function Share({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-1.5 w-full min-w-16 rounded-full bg-canvas">
      <div className="h-full rounded-full bg-accent" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
  );
}

// ---------- JSON ----------

export function Json({ value, className = "max-h-96" }: { value: unknown; className?: string }) {
  return <pre className={`overflow-auto rounded-xl bg-canvas p-4 font-mono text-[12px] leading-relaxed text-fg ring-1 ring-line ${className}`}>{JSON.stringify(value, null, 2)}</pre>;
}

export function Details({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-sm font-medium text-accent marker:hidden">
        <span className="inline-block transition-transform group-open:rotate-90">›</span> {summary}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
