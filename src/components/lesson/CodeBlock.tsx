"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import type { Block, TraceStep } from "@/lib/lessonBlocks";
import { spring } from "../motion/presets";
import { Burst } from "../motion/primitives";
import { BlockFrame } from "./BlockFrame";
import { rich } from "./rich";

type CodeData = Extract<Block, { kind: "code" }>;

const MODE = {
  predict: { icon: "▷", label: "Predict the output" },
  bug: { icon: "✎", label: "Find the fix" },
  trace: { icon: "⇣", label: "Step through it" },
} as const;

// Light, dependency-free tinting: strings, comments, numbers, common keywords.
const TOKEN = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|#.*$|\/\/.*$|\b\d+(?:\.\d+)?\b|\b(?:def|return|for|while|in|if|elif|else|and|or|not|print|range|len|import|from|class|function|const|let|var|true|false|True|False|None|null|break|continue|lambda|with|as|try|except|catch)\b)/;

function tint(line: string) {
  return line.split(TOKEN).map((part, i) => {
    if (i % 2 === 0 || !part) return part;
    const kind = /^["']/.test(part) ? "str" : /^(#|\/\/)/.test(part) ? "com" : /^\d/.test(part) ? "num" : "kw";
    return (
      <span key={i} className={`tok-${kind}`}>
        {part}
      </span>
    );
  });
}

function CodeWindow({ code, language, active }: { code: string; language: string; active?: number }) {
  const lines = code.split("\n");
  // One highlight per window that glides from line to line as the trace runs.
  const highlightId = useId();
  return (
    <div className="code-window" role="figure" aria-label={`${language} code, ${lines.length} lines`}>
      <div className="code-bar" aria-hidden>
        <span />
        <span />
        <span />
        <em>{language}</em>
      </div>
      <pre className="font-mono">
        {lines.map((l, i) => (
          <div key={i} className="code-line" data-active={active === i + 1 || undefined} aria-current={active === i + 1 ? "step" : undefined}>
            {active === i + 1 && <motion.span layoutId={highlightId} className="code-highlight" transition={spring.gentle} aria-hidden />}
            <span className="code-no" aria-hidden>
              {i + 1}
            </span>
            <code>{l ? tint(l) : " "}</code>
          </div>
        ))}
      </pre>
    </div>
  );
}

/** Real code to read: predict its output, pick the fix for its bug, or step through it line by line. */
export function CodeBlock({ b, onDone }: { b: CodeData; onDone: () => void }) {
  return b.mode === "trace" ? <TraceCode b={b} onDone={onDone} /> : <ChoiceCode b={b} onDone={onDone} />;
}

function ChoiceCode({ b, onDone }: { b: CodeData; onDone: () => void }) {
  // Practice, not graded: a wrong pick explains itself and the learner tries again.
  const [tried, setTried] = useState<number[]>([]);
  const [hints, setHints] = useState(0);
  const solved = tried.some((i) => b.options[i].correct);
  const last = tried[tried.length - 1];

  function pick(i: number) {
    if (solved || tried.includes(i)) return;
    setTried((t) => [...t, i]);
    if (b.options[i].correct) onDone();
  }

  return (
    <BlockFrame
      kind="code"
      icon={MODE[b.mode].icon}
      label={MODE[b.mode].label}
      title={b.heading}
      prompt={b.prompt}
      done={solved}
      takeaway={b.explanation ? rich(b.explanation) : undefined}
      takeawayLabel="Why"
    >
      <CodeWindow code={b.code} language={b.language} />
      <div className="relative mt-4 grid gap-2.5">
        <Burst trigger={solved ? "solved" : null} />
        {b.options.map((o, i) => {
          const chosen = tried.includes(i);
          const state = chosen ? (o.correct ? "good" : "bad") : "idle";
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              disabled={solved || chosen}
              data-state={state}
              className={`choice-option rounded-2xl border px-4 py-3 text-left text-sm leading-snug ${b.mode === "predict" ? "font-mono whitespace-pre-wrap" : ""}`}
            >
              <span className="mr-2 font-sans font-semibold text-accent">{String.fromCharCode(65 + i)}</span>
              {o.text}
              {chosen && <span className="ml-1 font-sans">{o.correct ? " ✓" : " ✗"}</span>}
            </button>
          );
        })}
      </div>
      {last !== undefined && (
        <div key={last} role="status" className="activity-feedback mt-4 rounded-2xl border border-line bg-canvas p-4">
          <p className={`text-xs font-semibold tracking-wide uppercase ${b.options[last].correct ? "text-good" : "text-bad"}`}>
            {b.options[last].correct ? (tried.length === 1 ? "Exactly right" : "Got it") : "Not this one"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-fg/90">{rich(b.options[last].feedback)}</p>
          {!b.options[last].correct && <p className="mt-2 text-xs text-muted">Read the code again and try another answer.</p>}
        </div>
      )}
      {!solved && b.hints.length > 0 && (
        <div className="mt-4 space-y-2">
          {b.hints.slice(0, hints).map((h, i) => (
            <p key={i} className="hint-reveal rounded-xl border border-accent/25 bg-accent-soft px-4 py-2.5 text-sm text-fg">
              <span className="mr-2 text-[11px] font-semibold tracking-wide text-accent uppercase">Hint {i + 1}</span>
              {rich(h)}
            </p>
          ))}
          {hints < b.hints.length && (
            <button type="button" onClick={() => setHints((n) => n + 1)} className="rounded-full border border-accent/40 px-3 py-1 text-xs font-medium text-accent hover:bg-accent-soft">
              {hints === 0 ? "Need a hint?" : "Another hint"}
            </button>
          )}
        </div>
      )}
    </BlockFrame>
  );
}

function TraceCode({ b, onDone }: { b: CodeData; onDone: () => void }) {
  // -1 = not started; otherwise the index of the step being shown.
  const [step, setStep] = useState(-1);
  const [finished, setFinished] = useState(false);
  const current = step >= 0 ? b.trace[step] : null;

  function go(next: number) {
    const clamped = Math.max(-1, Math.min(b.trace.length - 1, next));
    setStep(clamped);
    if (clamped === b.trace.length - 1 && !finished) {
      setFinished(true);
      onDone();
    }
  }

  return (
    <BlockFrame
      kind="code"
      icon={MODE.trace.icon}
      label={MODE.trace.label}
      title={b.heading}
      prompt={b.prompt}
      done={finished}
      takeaway={b.explanation ? rich(b.explanation) : undefined}
      takeawayLabel="What happened"
    >
      <CodeWindow code={b.code} language={b.language} active={current?.line} />
      <div className="trace-panel mt-4 rounded-2xl border border-line bg-canvas p-4" aria-live="polite">
        {current ? (
          <>
            <p className="text-xs font-semibold tracking-wide text-accent uppercase">
              Step {step + 1} of {b.trace.length} · line {current.line}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-fg">{rich(current.note)}</p>
            {current.state && <TraceState trace={b.trace} step={step} />}
          </>
        ) : (
          <p className="text-sm text-muted">Before you start: what do you expect each variable to be at the end? Then step through and check.</p>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => go(step - 1)} disabled={step < 0} className="rounded-full border border-line px-4 py-2 text-sm text-fg hover:border-accent/60 disabled:opacity-40">
          ◀ Back
        </button>
        <button type="button" onClick={() => go(step + 1)} disabled={step === b.trace.length - 1} className="btn-primary rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40">
          {step < 0 ? "Run line by line ▶" : "Next step ▶"}
        </button>
        {step >= 0 && (
          <button type="button" onClick={() => setStep(-1)} className="ml-auto text-xs text-muted underline-offset-2 hover:text-accent hover:underline">
            Restart
          </button>
        )}
      </div>
    </BlockFrame>
  );
}

// ---------- variables during a trace ----------

type Binding = { name: string; value: string };

/** Splits on commas that aren't inside brackets or quotes. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote && text[i - 1] !== "\\") quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth = Math.max(0, depth - 1);
    else if (c === "," && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Splits "i = 2, total = [1, 2]" into bindings; null if it isn't that shape. Trailing "— notes" are dropped. */
export function parseBindings(state: string): Binding[] | null {
  const parts = splitTopLevel(state);
  const out: Binding[] = [];
  for (const part of parts) {
    const m = part.match(/^([A-Za-z_][\w.[\]]*)\s*=\s*(.+)$/);
    if (!m) return null;
    // Drop a trailing note the writer adds ("\"Ada\" — 1 of 2 items"): it isn't the value.
    out.push({ name: m[1], value: m[2].split(/\s+[—–]\s+/)[0].trim() });
  }
  return out.length ? out : null;
}

/**
 * Every variable seen up to `step`, with its latest value, and which ones the
 * step changed. Built only from the lesson's own trace.
 */
export function variablesAt(trace: { state: string }[], step: number) {
  const values = new Map<string, string>();
  let before = new Map<string, string>();
  for (let s = 0; s <= step; s++) {
    before = new Map(values);
    for (const b of parseBindings(trace[s].state) ?? []) values.set(b.name, b.value);
  }
  return [...values].map(([name, value]) => ({ name, value, changed: before.get(name) !== value }));
}

/** The program's variables at this step: values that change flip into place. */
function TraceState({ trace, step }: { trace: TraceStep[]; step: number }) {
  const raw = trace[step].state;
  if (!parseBindings(raw)) {
    // Free-text state ("names is unchanged"): show it as written.
    return <p className="font-mono mt-3 rounded-lg border border-accent/30 bg-accent-soft px-2.5 py-1.5 text-xs text-fg">{raw}</p>;
  }
  return (
    <dl className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2" aria-label="Variables">
      {variablesAt(trace, step).map((v) => (
        <motion.div
          key={v.name}
          layout
          className="trace-var rounded-lg border px-2.5 py-1.5"
          data-changed={v.changed || undefined}
          transition={spring.gentle}
        >
          <dt className="font-mono text-[11px] text-muted">{v.name}</dt>
          <dd className="font-mono relative h-5 overflow-hidden text-sm text-fg">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={v.value}
                className="absolute inset-x-0 truncate"
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -14, opacity: 0 }}
                transition={spring.snappy}
              >
                {v.value}
              </motion.span>
            </AnimatePresence>
          </dd>
        </motion.div>
      ))}
    </dl>
  );
}
