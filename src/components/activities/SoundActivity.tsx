"use client";

import { useEffect, useRef, useState } from "react";
import type { Activity } from "@/lib/activities";
import { ActivityFrame } from "./ActivityFrame";

type SoundData = Extract<Activity, { type: "sound" }>;

const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C#4" → MIDI number. */
function midi(note: string) {
  const m = note.match(/^([A-G])(#|b)?(\d)$/);
  if (!m) return 60;
  return 12 * (Number(m[3]) + 1) + SEMITONE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}
const freq = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Playable chords and melodies, synthesised in the browser, on a glowing mini keyboard. */
export function SoundActivity({ a, onDone }: { a: SoundData; onDone: () => void }) {
  const ctx = useRef<AudioContext | null>(null);
  const [lit, setLit] = useState<number[]>([]);
  const [played, setPlayed] = useState<Set<number>>(() => new Set());
  const [mode, setMode] = useState<"chord" | "arpeggio">("chord");
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function tone(m: number, start: number, length: number) {
    const ac = ctx.current!;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq(m);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + length + 0.05);
  }

  function play(i: number) {
    ctx.current ??= new AudioContext();
    const ac = ctx.current;
    const notes = a.clips[i].notes.map(midi);
    const now = ac.currentTime + 0.02;
    timers.current.forEach(clearTimeout);
    if (mode === "chord") {
      notes.forEach((m) => tone(m, now, 2.2));
      setLit(notes);
      timers.current = [window.setTimeout(() => setLit([]), 1800)];
    } else {
      notes.forEach((m, k) => tone(m, now + k * 0.38, 1.1));
      timers.current = notes.map((m, k) => window.setTimeout(() => setLit([m]), k * 380));
      timers.current.push(window.setTimeout(() => setLit([]), notes.length * 380 + 500));
    }
    const next = new Set(played).add(i);
    setPlayed(next);
    onDone();
  }

  // Two octaves around the notes used.
  const all = a.clips.flatMap((c) => c.notes.map(midi));
  const lo = Math.floor(Math.min(...all) / 12) * 12;
  const keys = Array.from({ length: 25 }, (_, k) => lo + k);
  const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(m % 12);
  const whites = keys.filter((k) => !isBlack(k));

  return (
    <ActivityFrame type="sound" title={a.title} prompt={a.prompt} reveal={a.reveal} done={played.size > 0}>
      <div className="relative h-28 overflow-hidden rounded-2xl border border-line bg-canvas p-2" aria-hidden>
        <div className="relative flex h-full">
          {whites.map((k) => (
            <span key={k} className="piano-white flex-1 rounded-b-md border-r border-line" data-lit={lit.includes(k) || undefined} />
          ))}
          {keys.filter(isBlack).map((k) => {
            const leftWhites = whites.filter((w) => w < k).length;
            return (
              <span
                key={k}
                className="piano-black absolute top-0 h-[60%] rounded-b-md"
                data-lit={lit.includes(k) || undefined}
                style={{ left: `calc(${(leftWhites / whites.length) * 100}% - ${50 / whites.length / 1.6}%)`, width: `${100 / whites.length / 1.6}%` }}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="text-muted">Play as</span>
        {(["chord", "arpeggio"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full border px-3 py-1 ${mode === m ? "border-accent bg-accent-soft text-accent" : "border-line text-fg/80"}`}>
            {m === "chord" ? "Chord" : "One by one"}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {a.clips.map((c, i) => (
          <button key={i} type="button" onClick={() => play(i)} className="sound-clip flex items-start gap-3 rounded-2xl border border-line bg-canvas p-4 text-left hover:border-accent/60">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white">▶</span>
            <span>
              <span className="block font-semibold text-fg">{c.label}</span>
              <span className="block text-xs text-accent">{c.notes.join(" · ")}</span>
              {c.detail && <span className="mt-1 block text-xs leading-relaxed text-muted">{c.detail}</span>}
            </span>
            {played.has(i) && <span className="ml-auto text-xs text-good">✓</span>}
          </button>
        ))}
      </div>
    </ActivityFrame>
  );
}
