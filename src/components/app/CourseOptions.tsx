"use client";

import { Archive, ArchiveRestore, Check, Link2, Play, RotateCcw, Share2, Square } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useAppState } from "@/components/app/AppState";
import type { Course } from "@/components/types";
import { isRemote } from "@/lib/remoteImage";
import { REGISTERS, VOICE_INFO, type Register, type Voice } from "@/lib/voices";

// The bottom of a course page: who speaks in the course and in which voice
// (each can be recast), sharing the course, archiving it and starting over.

const REGISTER_LABEL: Record<Register, string> = { deep: "Deeper voices", bright: "Brighter voices", neutral: "Neutral voices" };

/** One preview sample at a time on the page. */
let sample: HTMLAudioElement | null = null;

export function CourseVoices({ course }: { course: Course }) {
  const { changeCourse } = useAppState();
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<Voice | null>(null);

  useEffect(() => () => sample?.pause(), []);

  if (course.cast.length === 0) return null;

  function preview(voice: Voice) {
    sample?.pause();
    if (playing === voice) {
      setPlaying(null);
      return;
    }
    const a = new Audio(`/audio/voices/${voice}.wav`);
    sample = a;
    setPlaying(voice);
    a.onended = a.onpause = () => setPlaying((p) => (p === voice ? null : p));
    a.play().catch(() => setPlaying(null));
  }

  async function recast(key: string, voice: Voice) {
    setSaving(key);
    setSaved(null);
    setError("");
    try {
      await changeCourse(course.id, { action: "recast", key, voice });
      setSaved(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change the voice.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-line sm:p-6" aria-labelledby="voices">
      <h2 id="voices" className="text-[15px] font-semibold text-fg">
        Voices in this course
      </h2>
      <p className="mt-1 text-sm text-muted">Each guide keeps their voice in every lesson. Pick another and their next lines use it.</p>
      <ul className="mt-4 divide-y divide-line">
        {course.cast.map((m) => (
          <li key={m.key} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-accent-soft">
              {m.portrait ? (
                <Image unoptimized={isRemote(m.portrait)} src={m.portrait} alt="" fill sizes="40px" className="scale-[1.5] object-cover object-[50%_30%]" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-accent">
                  {m.name.replace(/^(Dr|Prof)\.?\s+/, "").charAt(0)}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-fg">{m.name}</span>
              <span className="block text-xs text-muted">
                {saving === m.key ? "Saving…" : saved === m.key ? "Saved: new lines use this voice" : m.chosen ? "Your choice" : "Chosen for this course"}
              </span>
            </span>
            <label className="sr-only" htmlFor={`voice-${m.key}`}>
              Voice for {m.name}
            </label>
            <select
              id={`voice-${m.key}`}
              value={m.voice}
              disabled={saving === m.key}
              onChange={(e) => recast(m.key, e.target.value as Voice)}
              className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-fg outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
            >
              {(Object.keys(REGISTERS) as Register[]).map((r) => (
                <optgroup key={r} label={REGISTER_LABEL[r]}>
                  {REGISTERS[r].map((v) => (
                    <option key={v} value={v}>
                      {VOICE_INFO[v].label} · {VOICE_INFO[v].about}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              onClick={() => preview(m.voice)}
              aria-label={playing === m.voice ? "Stop the sample" : `Hear ${VOICE_INFO[m.voice].label}`}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted ring-1 ring-line hover:text-fg"
            >
              {playing === m.voice ? <Square size={13} /> : <Play size={14} />}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
    </section>
  );
}

/** A link anyone can open to start the same course (/start). */
export function shareLink(topic: string) {
  return `${window.location.origin}/start?topic=${encodeURIComponent(topic)}`;
}

/** Shares the course with the phone's share sheet, else copies the link. */
export function ShareCourseButton({ course, className = "" }: { course: Pick<Course, "topic" | "title">; className?: string }) {
  const [copied, setCopied] = useState(false);
  // Clipboard blocked: the link is shown to copy by hand.
  const [manual, setManual] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function share() {
    const url = shareLink(course.topic);
    const text = `I'm learning ${course.title} on Wondersity. Start the same course:`;
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title: course.title, text, url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 2400);
    } catch {
      setManual(url);
    }
  }

  return (
    <>
      <button type="button" onClick={share} className={`btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${className}`}>
        {copied ? <Check size={15} className="text-good" /> : <Share2 size={15} />}
        {copied ? "Link copied" : "Share course"}
      </button>
      {manual && (
        <input
          readOnly
          value={manual}
          aria-label="Link to share"
          onFocus={(e) => e.currentTarget.select()}
          autoFocus
          className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-fg"
        />
      )}
    </>
  );
}

export function CourseActions({ course }: { course: Course }) {
  const { changeCourse } = useAppState();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"archive" | "reset" | null>(null);
  const [note, setNote] = useState("");
  const started = course.modules.some((m) => m.lesson);

  async function run(kind: "archive" | "reset") {
    setBusy(kind);
    setNote("");
    try {
      await changeCourse(course.id, kind === "reset" ? { action: "reset" } : { action: "archive", archived: !course.archived });
      setNote(kind === "reset" ? "Started over: lesson 1 is next." : course.archived ? "Back in your courses." : "Archived. It's under Archived on Courses.");
      setConfirming(false);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-line sm:p-6" aria-labelledby="course-options">
      <h2 id="course-options" className="text-[15px] font-semibold text-fg">
        Course options
      </h2>
      <div className="mt-4 flex flex-wrap gap-2">
        <ShareCourseButton course={course} />
        <button
          type="button"
          onClick={() => run("archive")}
          disabled={!!busy}
          className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
        >
          {course.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
          {busy === "archive" ? "Saving…" : course.archived ? "Unarchive" : "Archive"}
        </button>
        {started && !confirming && (
          <button type="button" onClick={() => setConfirming(true)} className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium">
            <RotateCcw size={15} /> Start over
          </button>
        )}
      </div>
      {confirming && (
        <div className="mt-4 rounded-xl bg-canvas p-4 ring-1 ring-line">
          <p className="text-sm text-fg">
            Start this course again from lesson 1? Lessons you&rsquo;ve done are kept in your history, with your streak and any certificate, but the course shows them as not started.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => run("reset")} disabled={!!busy} className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold">
              {busy === "reset" ? "Starting over…" : "Yes, start over"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-xl px-4 py-2 text-sm text-muted hover:text-fg">
              Cancel
            </button>
          </div>
        </div>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
        {note || (
          <>
            <Link2 size={12} /> A shared link starts the same course for whoever opens it.
          </>
        )}
      </p>
    </section>
  );
}
