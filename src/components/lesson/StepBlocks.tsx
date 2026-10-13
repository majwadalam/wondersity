"use client";

import { Square, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { spring } from "../motion/presets";
import { modelAnswerText, type Block } from "@/lib/lessonBlocks";
import { BlockFrame, Paragraphs } from "./BlockFrame";
import { rich } from "./rich";
import { playLine, stopLine, type VoiceControl } from "./Scene";

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
type Grade = { verdict: "got_it" | "partly" | "not_yet"; right: string; missing: string };

const VERDICT: Record<Grade["verdict"], { label: string; className: string }> = {
  got_it: { label: "You've got it", className: "bg-[#e9f8ef] text-good" },
  partly: { label: "Partly there", className: "bg-accent-soft text-accent" },
  not_yet: { label: "Not quite yet", className: "bg-[#fdecec] text-bad" },
};

/**
 * The learner writes an answer in their own words; the server grades it
 * against the lesson's model answer (lib/reflectGrade.ts) and says what they
 * got right and what's missing, then shows the model answer. Practice: the
 * grade isn't saved. Without a saved lesson, or if grading fails, it falls
 * back to showing the model answer to compare with.
 */
export function ReflectBlock({ b, onDone, lessonId, blockIndex }: { b: Of<"reflect">; onDone: () => void; lessonId?: number | null; blockIndex?: number }) {
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<"writing" | "checking" | "done">("writing");
  const [grade, setGrade] = useState<Grade | null>(null);
  const ready = answer.trim().length >= MIN_REFLECTION;
  const canGrade = typeof lessonId === "number" && typeof blockIndex === "number";

  async function check() {
    setPhase("checking");
    let g: Grade | null = null;
    if (canGrade) {
      try {
        const res = await fetch("/api/reflect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, block: blockIndex, answer: answer.trim() }),
        });
        if (res.ok) g = (await res.json()).grade ?? null;
      } catch {
        // Falls back to the model answer below.
      }
    }
    setGrade(g);
    setPhase("done");
    onDone();
  }

  return (
    <BlockFrame kind="reflect" icon="✍" label="In your own words" title={b.heading} prompt={b.prompt} done={phase === "done"}>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        readOnly={phase !== "writing"}
        rows={4}
        aria-label={b.prompt}
        placeholder="Write a few sentences in your own words."
        className="w-full resize-y rounded-2xl border border-line bg-canvas p-4 text-[15px] leading-relaxed text-fg placeholder:text-muted/70 focus:border-accent/60 focus:outline-none"
      />
      {phase !== "done" ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!ready || phase === "checking"}
            onClick={check}
            className="btn-primary rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            {phase === "checking" ? "Checking…" : canGrade ? "Check my answer" : "Compare with a model answer"}
          </button>
          <span className="text-xs text-muted">
            {ready ? "Practice: it isn't saved or counted." : `Write at least ${MIN_REFLECTION} characters first.`}
          </span>
        </div>
      ) : (
        <div className="step-reveal mt-4 space-y-3" aria-live="polite">
          {grade && (
            <div className="rounded-2xl border border-line bg-surface px-4 py-3">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${VERDICT[grade.verdict].className}`}>{VERDICT[grade.verdict].label}</span>
              {grade.right && <p className="mt-2 text-sm leading-relaxed text-fg">{rich(grade.right)}</p>}
              {grade.missing && (
                <p className="mt-1.5 text-sm leading-relaxed text-fg">
                  <span className="font-semibold">To add: </span>
                  {rich(grade.missing)}
                </p>
              )}
            </div>
          )}
          <div className="rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-accent uppercase">A model answer</p>
            <p className="mt-1 text-sm leading-relaxed text-fg">{rich(modelAnswerText(b.model))}</p>
            {!grade && <p className="mt-2 text-xs text-muted">What did you include that it doesn&rsquo;t, and what did it notice that you didn&rsquo;t?</p>}
          </div>
          {grade && grade.verdict !== "got_it" && (
            <button type="button" onClick={() => setPhase("writing")} className="text-sm font-medium text-accent hover:underline">
              Edit your answer and check again
            </button>
          )}
        </div>
      )}
    </BlockFrame>
  );
}

/**
 * A Socratic exchange that unfolds a line at a time, so the learner can answer
 * each question in their head first. With voice, "Listen" reads it aloud, each
 * speaker in their own voice (the course's cast), and stops after a question
 * until the learner continues.
 */
export function DialogueBlock({
  b,
  onDone,
  voice = null,
  blockIndex,
  active = true,
}: {
  b: Of<"dialogue">;
  onDone: () => void;
  voice?: VoiceControl | null;
  blockIndex?: number;
  /** Whether this block's step is on screen; leaving it stops the reading. */
  active?: boolean;
}) {
  const [shown, setShown] = useState(1);
  const [listening, setListening] = useState(false);
  const [speakingTurn, setSpeakingTurn] = useState<number | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  // Bumped when a reading is started or stopped; an older one that's still loading gives up.
  const run = useRef(0);
  const first = b.turns[0]?.speaker;
  const done = shown >= b.turns.length;
  const canListen = !!voice && blockIndex !== undefined;
  const asks = (i: number) => b.turns[i]?.text.trim().endsWith("?");

  function stop() {
    run.current++;
    stopLine(audio.current);
    audio.current = null;
    setListening(false);
    setSpeakingTurn(null);
  }

  // Reads turn i, then goes on to the next one unless this one asked the learner something.
  async function read(i: number) {
    if (!voice || blockIndex === undefined) return;
    const id = ++run.current;
    setListening(true);
    for (let t = i; t < b.turns.length; t++) {
      setShown((n) => Math.max(n, t + 1));
      if (t === b.turns.length - 1) onDone();
      const url = await voice.urlForTurn(blockIndex, t);
      if (id !== run.current) return;
      if (t + 1 < b.turns.length) voice.urlForTurn(blockIndex, t + 1); // ready by the time this turn ends
      if (url) {
        setSpeakingTurn(t);
        const line = playLine(url);
        audio.current = line.audio;
        const finished = await line.done;
        if (id !== run.current) return;
        if (!finished) break;
      }
      if (asks(t)) break;
    }
    setSpeakingTurn(null);
    if (id === run.current) audio.current = null;
  }

  // Leaving the step ends the reading: the audio here, the state while rendering.
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (!active) {
      setListening(false);
      setSpeakingTurn(null);
    }
  }
  useEffect(() => {
    if (active) return;
    run.current++;
    stopLine(audio.current);
  }, [active]);
  useEffect(() => () => stopLine(audio.current), []);

  function next() {
    const n = Math.min(b.turns.length, shown + 1);
    setShown(n);
    if (n === b.turns.length) onDone();
    if (listening) read(n - 1);
  }

  return (
    <BlockFrame kind="dialogue" icon="❞" label="Dialogue" title={b.heading} done={done}>
      {canListen && (
        <button
          type="button"
          onClick={() => (listening ? stop() : read(Math.max(0, shown - 1)))}
          aria-pressed={listening}
          className={`mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
            listening ? "bg-accent-soft text-accent ring-accent/20" : "text-muted ring-line hover:text-fg"
          }`}
        >
          {listening ? <Square size={12} /> : <Volume2 size={14} />}
          {listening ? "Stop" : "Listen"}
        </button>
      )}
      <div className="space-y-3" aria-live="polite">
        {b.turns.slice(0, shown).map((t, i) => (
          <div key={i} className={`step-reveal flex ${t.speaker === first ? "justify-start" : "justify-end"}`}>
            <div
              className={`dialogue-bubble max-w-[85%] rounded-2xl px-4 py-3 transition-shadow ${t.speaker === first ? "rounded-tl-sm bg-canvas ring-1 ring-line" : "rounded-tr-sm bg-accent-soft"} ${
                speakingTurn === i ? "ring-2 ring-accent/40" : ""
              }`}
            >
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-accent uppercase">
                {t.speaker}
                {speakingTurn === i && <Volume2 size={12} className="animate-pulse" aria-label="speaking" />}
              </p>
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
          {asks(shown - 1) && <span className="text-xs text-muted">Answer it yourself first.</span>}
        </div>
      )}
    </BlockFrame>
  );
}
