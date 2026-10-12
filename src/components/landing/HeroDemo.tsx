"use client";

import { Volume2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// The product itself, in a window: a real lesson step as Wondersity shows it on a
// wide screen, with the scene on the left and the learner's move on the right.
// The question works; the replies are Socrates's.

const OPTIONS = [
  { text: "Yes. The city voted for it.", correct: false, reply: "Athens also voted to put me to death. Was that just, because it was a vote?" },
  { text: "No. A law can still be unjust.", correct: true, reply: "Then obeying and being just are not the same thing. So, Crito, should I escape?" },
  { text: "Only if most citizens agree.", correct: false, reply: "Most citizens agreed to my sentence. Does that make it just?" },
  { text: "Yes, if the courts uphold it.", correct: false, reply: "The court upheld my sentence too. Is a law just because judges defend it?" },
];
const OPENING = "You say a citizen must always obey the law. Tell me: is every law Athens passes a just law?";

export function ProductWindow() {
  const [picked, setPicked] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  function speak() {
    audio.current ??= new Audio("/audio/socrates-crito.m4a");
    const a = audio.current;
    a.onended = a.onpause = () => setSpeaking(false);
    a.currentTime = 0;
    a.play().then(() => setSpeaking(true)).catch(() => setSpeaking(false));
  }
  const answer = picked === null ? null : OPTIONS[picked];
  const line = answer ? answer.reply : OPENING;

  return (
    <div className="product-window overflow-hidden rounded-2xl bg-white text-left">
      {/* Lesson top bar */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
        <span className="hidden text-[13px] font-medium text-fg sm:block">Socrates and the law</span>
        <span className="hidden text-[13px] text-muted sm:block">Lesson 3</span>
        <div className="flex flex-1 gap-1 sm:ml-4" aria-hidden>
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < 4 ? "bg-accent" : "bg-canvas ring-1 ring-line ring-inset"}`} />
          ))}
        </div>
        <span className="text-[11px] font-medium text-muted tabular-nums">5/10</span>
        <span className="hidden items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent sm:flex">
          <Volume2 size={12} /> Voice on
        </span>
      </div>

      <div className="grid gap-0 md:grid-cols-[1fr_1.05fr]">
        {/* The scene */}
        <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[440px]">
          <Image unoptimized src="/art/scenes/crito-prison.webp" alt="Socrates and Crito in a stone prison cell in Athens, the Acropolis through the window" fill sizes="(min-width: 768px) 560px, 100vw" className="object-cover" priority />
          <span className="absolute top-3 left-3 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">Prison of Athens · 399 BC</span>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0a2540]/95 via-[#0a2540]/60 to-transparent px-4 pt-16 pb-4 sm:px-5">
            <div className="flex items-start gap-3">
              <span className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-white/80">
                <Image unoptimized src="/art/scenes/guide-socrates.webp" alt="" fill sizes="44px" className="scale-[1.6] object-cover object-[50%_30%]" />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-white/75">
                  Socrates
                  {picked === null && (
                    <button type="button" onClick={speak} className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] text-white hover:bg-white/25">
                      <Volume2 size={12} strokeWidth={2} className={speaking ? "animate-pulse" : ""} /> {speaking ? "Speaking" : "Listen"}
                    </button>
                  )}
                </p>
                <p key={line} className="step-sheet mt-0.5 text-[15px] leading-snug text-white">
                  {line}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Your move */}
        <div className="flex flex-col p-5 sm:p-7">
          <p className="flex items-center gap-2 text-sm font-semibold text-accent">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-xs">?</span> Check 2 of 3
          </p>
          <p className="mt-3 text-[19px] leading-snug font-semibold tracking-[-0.01em] text-fg sm:text-[21px]">
            Crito begs Socrates to escape. Socrates asks whether a law is just because the city made it. What do you say?
          </p>
          <div className="mt-5 space-y-2.5">
            {OPTIONS.map((o, i) => {
              const state = picked === i ? (o.correct ? "right" : "wrong") : "idle";
              return (
                <button
                  key={o.text}
                  type="button"
                  onClick={() => setPicked(i)}
                  disabled={answer?.correct}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[14.5px] transition-colors ${
                    state === "right"
                      ? "border-good bg-[#ecfbf1] text-fg"
                      : state === "wrong"
                        ? "border-bad/40 bg-[#fdeeee] text-fg"
                        : "border-line bg-white text-fg hover:border-accent/50 hover:bg-accent-soft/40 disabled:opacity-50"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                      state === "right" ? "bg-good text-white" : state === "wrong" ? "bg-bad text-white" : "bg-canvas text-muted ring-1 ring-line"
                    }`}
                  >
                    {"ABCD"[i]}
                  </span>
                  {o.text}
                </button>
              );
            })}
          </div>
          <p className="mt-4 min-h-10 text-sm leading-relaxed text-muted" aria-live="polite">
            {answer
              ? answer.correct
                ? "Right. Being lawful and being just can come apart, and that is the whole problem of the Crito."
                : "Not quite. Socrates isn't convinced; read his reply and try another answer."
              : "Pick an answer. A wrong one doesn't give the game away: you get a new way to think about it."}
          </p>
          <div className="mt-auto flex items-center justify-end border-t border-line pt-4">
            <span className={`rounded-full px-6 py-2.5 text-sm font-semibold ${answer?.correct ? "bg-accent text-white" : "bg-accent/30 text-white"}`}>Continue</span>
          </div>
        </div>
      </div>
    </div>
  );
}
