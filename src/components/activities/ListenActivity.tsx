"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Activity } from "@/lib/activities";
import { ActivityFrame } from "./ActivityFrame";

type ListenData = Extract<Activity, { type: "listen" }>;

const noSubscribe = () => () => {};

/** A narrated snippet, read aloud by the browser's built-in voice. */
export function ListenActivity({ a, onDone }: { a: ListenData; onDone: () => void }) {
  const supported = useSyncExternalStore(noSubscribe, () => "speechSynthesis" in window, () => true);
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [heard, setHeard] = useState(false);
  const [transcript, setTranscript] = useState(!supported);

  // Stop speaking if the learner leaves the page.
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function play() {
    const synth = window.speechSynthesis;
    if (state === "paused") {
      synth.resume();
      setState("playing");
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(a.script);
    const voice = synth.getVoices().find((v) => v.lang.startsWith("en") && /natural|google|samantha|daniel/i.test(v.name)) ?? synth.getVoices().find((v) => v.lang.startsWith("en"));
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = () => {
      setState("idle");
      setHeard(true);
      onDone();
    };
    synth.speak(u);
    setState("playing");
  }
  function pause() {
    window.speechSynthesis.pause();
    setState("paused");
  }

  return (
    <ActivityFrame type="listen" title={a.title} prompt={a.prompt} reveal={a.reveal} done={heard}>
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-canvas p-4">
        {supported ? (
          <button
            type="button"
            onClick={state === "playing" ? pause : play}
            aria-label={state === "playing" ? "Pause" : "Play narration"}
            className="btn-primary flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-xl"
          >
            {state === "playing" ? "❚❚" : "▶"}
          </button>
        ) : (
          <span className="text-xs text-muted">Audio isn&rsquo;t available in this browser, so here&rsquo;s the transcript.</span>
        )}
        <div className="listen-wave flex h-12 flex-1 items-center gap-[3px]" data-playing={state === "playing" || undefined} aria-hidden>
          {Array.from({ length: 36 }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${(i % 9) * 0.09}s`, height: `${30 + ((i * 37) % 60)}%` }} />
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          setTranscript((t) => !t);
          if (!heard) {
            setHeard(true);
            onDone();
          }
        }}
        className="mt-3 text-xs text-accent underline"
      >
        {transcript ? "Hide transcript" : "Read the transcript"}
      </button>
      {transcript && <p className="font-display mt-2 text-lg leading-relaxed text-fg/90 italic">&ldquo;{a.script}&rdquo;</p>}
    </ActivityFrame>
  );
}
