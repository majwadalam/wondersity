"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { spring } from "../motion/presets";
import type { Block } from "@/lib/lessonBlocks";
import { BlockFrame, Paragraphs } from "./BlockFrame";
import { rich } from "./rich";

type Of<K extends Block["kind"]> = Extract<Block, { kind: K }>;

/** A worked example, one step at a time: think about the next move, then reveal it. */
export function WorkedBlock({ b, onDone }: { b: Of<"worked">; onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const done = shown === b.steps.length;

  function next() {
    const n = Math.min(b.steps.length, shown + 1);
    setShown(n);
    if (n === b.steps.length) onDone();
  }

  return (
    <BlockFrame kind="worked" icon="∑" label="Worked example" title={b.heading} done={done} takeaway={b.answer ? rich(b.answer) : undefined} takeawayLabel="Result">
      <div className="rounded-2xl border border-line bg-canvas p-4 text-[15px] leading-relaxed text-fg">
        <Paragraphs text={b.problem} />
      </div>
      {/* Each step is built onto the last: the newest stands out, earlier ones settle back. */}
      <ol className="mt-4">
        {b.steps.slice(0, shown).map((s, i) => (
          <motion.li
            key={i}
            className="worked-step relative flex gap-3 pb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: i === shown - 1 || done ? 1 : 0.62, y: 0 }}
            transition={spring.gentle}
          >
            {i < shown - 1 && (
              <motion.span
                className="absolute top-8 bottom-0 left-[13px] w-px origin-top bg-accent/40"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.4 }}
                aria-hidden
              />
            )}
            <motion.span
              className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
              initial={{ scale: 0.4 }}
              animate={{ scale: 1 }}
              transition={spring.bouncy}
            >
              {i + 1}
            </motion.span>
            <div className="min-w-0 flex-1">
              {s.title && <p className="text-sm font-semibold text-fg">{s.title}</p>}
              <p className="text-[15px] leading-relaxed whitespace-pre-line text-fg/90">{rich(s.text)}</p>
              {s.why && <p className="mt-1 text-sm leading-relaxed text-muted">Why: {rich(s.why)}</p>}
            </div>
          </motion.li>
        ))}
      </ol>
      {!done && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={next} className="btn-primary rounded-full px-4 py-2 text-sm font-semibold">
            {shown === 0 ? "Show the first step" : `Show step ${shown + 1}`}
          </button>
          <span className="text-xs text-muted">
            {shown === 0 ? "Try the first move yourself before you look." : "What would you do next? Decide, then check."}
          </span>
        </div>
      )}
    </BlockFrame>
  );
}

const MIN_REFLECTION = 20;

/** An open question in the learner's own words, then a model answer to compare against. Nothing is saved. */
export function ReflectBlock({ b, onDone }: { b: Of<"reflect">; onDone: () => void }) {
  const [answer, setAnswer] = useState("");
  const [compared, setCompared] = useState(false);
  const ready = answer.trim().length >= MIN_REFLECTION;

  return (
    <BlockFrame kind="reflect" icon="✍" label="In your own words" title={b.heading} prompt={b.prompt} done={compared}>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        readOnly={compared}
        rows={4}
        aria-label={b.prompt}
        placeholder="Write a few sentences. Only you will see this."
        className="w-full resize-y rounded-2xl border border-line bg-canvas p-4 text-[15px] leading-relaxed text-fg placeholder:text-muted/70 focus:border-accent/60 focus:outline-none"
      />
      {!compared ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              setCompared(true);
              onDone();
            }}
            className="btn-primary rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Compare with a model answer
          </button>
          <span className="text-xs text-muted">
            {ready ? "Not saved or graded; it's for your thinking." : `Write at least ${MIN_REFLECTION} characters first.`}
          </span>
        </div>
      ) : (
        <div className="step-reveal mt-4 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-accent uppercase">A model answer</p>
          <p className="mt-1 text-sm leading-relaxed text-fg">{rich(b.model)}</p>
          <p className="mt-2 text-xs text-muted">What did you include that it doesn&rsquo;t, and what did it notice that you didn&rsquo;t?</p>
        </div>
      )}
    </BlockFrame>
  );
}

/** A Socratic exchange that unfolds a line at a time, so the learner can answer each question in their head first. */
export function DialogueBlock({ b, onDone }: { b: Of<"dialogue">; onDone: () => void }) {
  const [shown, setShown] = useState(1);
  const first = b.turns[0]?.speaker;
  const done = shown >= b.turns.length;

  function next() {
    const n = Math.min(b.turns.length, shown + 1);
    setShown(n);
    if (n === b.turns.length) onDone();
  }

  return (
    <BlockFrame kind="dialogue" icon="❞" label="Dialogue" title={b.heading} done={done}>
      <div className="space-y-3" aria-live="polite">
        {b.turns.slice(0, shown).map((t, i) => (
          <div key={i} className={`step-reveal flex ${t.speaker === first ? "justify-start" : "justify-end"}`}>
            <div className={`dialogue-bubble max-w-[85%] rounded-2xl px-4 py-3 ${t.speaker === first ? "rounded-tl-sm bg-canvas ring-1 ring-line" : "rounded-tr-sm bg-accent-soft"}`}>
              <p className="text-[11px] font-semibold tracking-wide text-accent uppercase">{t.speaker}</p>
              <p className="mt-0.5 text-[15px] leading-relaxed text-fg">{rich(t.text)}</p>
            </div>
          </div>
        ))}
      </div>
      {!done && (
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={next} className="btn-primary rounded-full px-4 py-2 text-sm font-semibold">
            Continue
          </button>
          {b.turns[shown - 1]?.text.trim().endsWith("?") && <span className="text-xs text-muted">Answer it yourself first.</span>}
        </div>
      )}
    </BlockFrame>
  );
}
