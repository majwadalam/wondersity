"use client";

import { Check, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppState } from "@/components/app/AppState";
import { rich } from "@/components/lesson/rich";
import { ReviewSkeleton } from "@/components/Skeletons";
import type { ReviewItem } from "@/lib/review";

// Review: every check answered wrong the first time, to try again. Practice:
// the first answer keeps its grade; a right answer now marks it cleared.

type Tab = "open" | "cleared";

export default function ReviewPage() {
  const { learnerId } = useAppState();
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("open");

  useEffect(() => {
    if (!learnerId) return;
    let live = true;
    fetch("/api/review")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => live && setItems(d.items))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [learnerId]);

  const open = items?.filter((i) => !i.clearedAt) ?? [];
  const cleared = items?.filter((i) => i.clearedAt) ?? [];
  const shown = tab === "open" ? open : cleared;
  // Grouped by course, in the order of their newest mistake.
  const groups = new Map<string, ReviewItem[]>();
  for (const i of shown) groups.set(i.courseTitle, [...(groups.get(i.courseTitle) ?? []), i]);

  const markCleared = (it: ReviewItem, answer: ReviewItem["answer"]) =>
    setItems((xs) => xs?.map((x) => (x.lessonId === it.lessonId && x.questionIndex === it.questionIndex ? { ...x, clearedAt: new Date().toISOString(), answer } : x)) ?? null);

  return (
    <main className="mx-auto max-w-3xl px-5 pt-12 pb-24">
      <h1 className="display-xl font-display text-4xl text-fg sm:text-5xl">Review</h1>
      <p className="mt-3 text-lg text-muted">Checks you missed the first time. Try them again: your first answer keeps its grade, and a right answer now clears it.</p>

      <div className="mt-8 flex gap-2" role="tablist" aria-label="Which mistakes">
        {(
          [
            ["open", `To review${items ? ` (${open.length})` : ""}`],
            ["cleared", `Cleared${items ? ` (${cleared.length})` : ""}`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-full px-4 py-2 text-sm font-medium ring-1 transition-colors ${tab === value ? "bg-accent-soft text-accent ring-accent/20" : "text-muted ring-line hover:text-fg"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {failed ? (
        <p className="mt-8 text-muted">Couldn&rsquo;t load your mistakes. Refresh to try again.</p>
      ) : !items ? (
        <ReviewSkeleton />
      ) : shown.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-surface p-10 text-center">
          <p className="font-display text-xl text-fg">{tab === "open" ? (items.length ? "All cleared." : "Nothing to review yet.") : "Nothing cleared yet."}</p>
          <p className="mt-2 text-muted">
            {tab === "open" ? (items.length ? "Every check you missed, you've since got right." : "Checks you miss in lessons will wait for you here.") : "Get a missed check right and it moves here."}
          </p>
          {tab === "open" && (
            <Link href="/courses" className="mt-5 inline-block font-medium text-accent hover:underline">
              Back to your courses
            </Link>
          )}
        </div>
      ) : (
        [...groups].map(([title, list]) => (
          <section key={title} className="mt-10" aria-label={title}>
            <h2 className="text-sm font-semibold text-fg">{title}</h2>
            <div className="mt-3 space-y-4">
              {list.map((it) => (
                <ReviewCard key={`${it.lessonId}:${it.questionIndex}`} item={it} onCleared={markCleared} />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}

function ReviewCard({ item, onCleared }: { item: ReviewItem; onCleared: (it: ReviewItem, answer: ReviewItem["answer"]) => void }) {
  const [tried, setTried] = useState<string[]>([]);
  const [retry, setRetry] = useState<string | null>(null);
  const [answer, setAnswer] = useState(item.answer);
  const [hints, setHints] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const solved = !!answer;

  async function send(chosen: string, reveal = false) {
    setBusy(true);
    setError(false);
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId: item.lessonId, questionIndex: item.questionIndex, chosen, ...(reveal ? { reveal } : {}) }),
    }).catch(() => null);
    setBusy(false);
    const d = res?.ok ? await res.json().catch(() => null) : null;
    if (!d) return setError(true);
    if (d.answer) setAnswer(d.answer);
    if (d.correct) onCleared(item, d.answer);
    else if (!reveal) {
      setTried((t) => [...t, chosen]);
      setRetry(d.retry);
    }
  }

  return (
    <article className="rounded-2xl bg-white p-5 ring-1 ring-line sm:p-6">
      <p className="text-xs text-muted">
        {item.lessonNumber ? `Lesson ${item.lessonNumber} · ` : ""}
        {item.lessonTitle}
        {item.clearedAt && (
          <span className="ml-2 inline-flex items-center gap-1 font-medium text-good">
            <Check size={12} /> Cleared
          </span>
        )}
      </p>
      <div className="mt-2 text-[17px] leading-relaxed text-fg">{rich(item.question)}</div>
      <div className="mt-4 space-y-2">
        {item.options.map((o, oi) => {
          const isRight = answer?.correct === o;
          const wrong = tried.includes(o);
          const state = isRight ? "correct" : wrong ? "wrong" : solved ? "dimmed" : "idle";
          return (
            <button
              key={o}
              type="button"
              disabled={solved || wrong || busy}
              onClick={() => send(o)}
              data-state={state}
              className="quiz-option flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-[15px]"
            >
              <span className="quiz-letter flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold">{String.fromCharCode(65 + oi)}</span>
              <span className="flex-1">{rich(o)}</span>
              {o === item.chosen && !isRight && <span className="text-xs text-muted">your first answer</span>}
            </button>
          );
        })}
      </div>
      {!solved && retry && <p className="mt-4 rounded-xl bg-canvas p-4 text-[15px] leading-relaxed text-fg">{rich(retry)}</p>}
      {!solved && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {hints < item.hints.length && (
            <button type="button" onClick={() => setHints((n) => n + 1)} className="font-medium text-accent hover:underline">
              {hints ? "Another hint" : "Show a hint"}
            </button>
          )}
          {tried.length >= 2 && (
            <button type="button" onClick={() => send("", true)} disabled={busy} className="inline-flex items-center gap-1 font-medium text-muted hover:text-fg">
              <RotateCcw size={13} /> Show the answer
            </button>
          )}
        </div>
      )}
      {!solved && hints > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm text-muted">
          {item.hints.slice(0, hints).map((h) => (
            <li key={h}>Hint: {rich(h)}</li>
          ))}
        </ul>
      )}
      {answer && (
        <div className="mt-4 rounded-xl bg-[#e9f8ef] p-4 text-[15px] leading-relaxed text-fg">
          <p className="text-sm font-semibold text-good">{item.clearedAt ? "Right. Here's why" : "The answer"}</p>
          <div className="mt-1">{rich(answer.explanation)}</div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-bad">Couldn&rsquo;t check that. Try again.</p>}
    </article>
  );
}
