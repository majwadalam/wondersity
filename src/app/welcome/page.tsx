"use client";

import Link from "next/link";

import { ArrowLeft, Briefcase, Compass, GraduationCap, Plane, Sparkles, Volume2, VolumeX } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAppState, useStartCourse } from "@/components/app/AppState";
import { LogoMark } from "@/components/app/Brand";
import { CATALOG } from "@/components/app/CourseCards";
import { CourseArt } from "@/components/app/CourseArt";

// First run after creating an account: a name, why they're here, a daily
// goal, voice on or off, and the first topic. Saved to the profile once, at
// the end; someone who has done it is sent straight on.

const REASONS = [
  { id: "curious", label: "Just curious", Icon: Compass },
  { id: "school", label: "School or exams", Icon: GraduationCap },
  { id: "work", label: "My work", Icon: Briefcase },
  { id: "travel", label: "A trip coming up", Icon: Plane },
  { id: "sharp", label: "Staying sharp", Icon: Sparkles },
];
const GOALS = [
  { minutes: 5, label: "Casual", note: "One short lesson every other day" },
  { minutes: 10, label: "Regular", note: "About a lesson a day" },
  { minutes: 20, label: "Serious", note: "Two lessons a day" },
  { minutes: 30, label: "Intense", note: "A level a week" },
];

export default function WelcomePage() {
  return (
    <Suspense>
      <Welcome />
    </Suspense>
  );
}

function Welcome() {
  const { profile, updateProfile } = useAppState();
  // A new topic opens the start dialog: plan it for me, or tailor it.
  const start = useStartCourse();
  const router = useRouter();
  const preset = useSearchParams().get("topic") ?? "";
  const [step, setStep] = useState(0);
  // Wondersity isn't built for children under 13 (COPPA), so the learner confirms their age.
  const [ofAge, setOfAge] = useState(false);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [goal, setGoal] = useState(10);
  const [voice, setVoice] = useState(true);
  const [topic, setTopic] = useState(preset);
  const [saving, setSaving] = useState(false);

  // Onboarded already: go on to the app (starting the topic they came with, if any).
  const done = profile?.onboarded;
  useEffect(() => {
    if (!done) return;
    router.replace("/home");
    if (preset) start(preset);
    // Once, when we learn they're onboarded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  if (!profile || done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent-soft border-t-accent" aria-label="Loading" />
      </main>
    );
  }

  const first = (name || profile.displayName || "").split(" ")[0];
  const steps = [
    {
      title: "What should we call you?",
      sub: "Your guides will use it.",
      ok: true,
      body: (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 60))}
          placeholder={profile.displayName ?? "Your first name"}
          className="w-full rounded-2xl border border-line bg-white px-5 py-4 text-xl text-fg outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
          onKeyDown={(e) => e.key === "Enter" && setStep(1)}
        />
      ),
    },
    {
      title: `What brings you here${first ? `, ${first}` : ""}?`,
      sub: "It shapes the examples your lessons use.",
      ok: !!reason,
      body: (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {REASONS.map(({ id, label, Icon }) => (
            <Choice key={id} on={reason === id} onClick={() => setReason(id)}>
              <Icon size={20} className={reason === id ? "text-accent" : "text-muted"} /> {label}
            </Choice>
          ))}
        </div>
      ),
    },
    {
      title: "Pick a daily goal",
      sub: "You can change it any time in Settings.",
      ok: true,
      body: (
        <div className="grid gap-2.5">
          {GOALS.map((g) => (
            <Choice key={g.minutes} on={goal === g.minutes} onClick={() => setGoal(g.minutes)}>
              <span className="w-16 font-mono text-sm text-muted tabular-nums">{g.minutes} min</span>
              <span className="font-semibold">{g.label}</span>
              <span className="ml-auto text-sm text-muted">{g.note}</span>
            </Choice>
          ))}
        </div>
      ),
    },
    {
      title: "Should your guide speak?",
      sub: "Every lesson has a guide, like Socrates or a field biologist, who can talk you through it out loud.",
      ok: true,
      body: (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Choice on={voice} onClick={() => setVoice(true)}>
            <Volume2 size={20} className={voice ? "text-accent" : "text-muted"} /> Yes, voice on
          </Choice>
          <Choice on={!voice} onClick={() => setVoice(false)}>
            <VolumeX size={20} className={!voice ? "text-accent" : "text-muted"} /> No, I&rsquo;ll read
          </Choice>
        </div>
      ),
    },
    {
      title: "What do you want to learn first?",
      sub: "Anything at all. Wondersity plans the course in under a minute.",
      ok: !!topic.trim(),
      body: (
        <div>
          <input
            autoFocus
            value={topic}
            onChange={(e) => setTopic(e.target.value.slice(0, 120))}
            placeholder="The Silk Road, black holes, jazz harmony…"
            className="w-full rounded-2xl border border-line bg-white px-5 py-4 text-xl text-fg outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
            onKeyDown={(e) => e.key === "Enter" && topic.trim() && finish()}
          />
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {CATALOG.slice(0, 6).map((c) => (
              <button
                key={c.topic}
                type="button"
                onClick={() => setTopic(c.topic)}
                className={`group overflow-hidden rounded-xl border bg-white text-left transition-all ${
                  topic === c.topic ? "border-accent ring-2 ring-accent/30" : "border-line hover:border-line-strong"
                }`}
              >
                <span className="relative block aspect-[4/3] overflow-hidden bg-canvas">
                  <CourseArt topic={c.topic} sizes="160px" />
                </span>
                <span className="block px-2.5 py-2 text-[13px] font-medium text-fg">{c.topic}</span>
              </button>
            ))}
          </div>
        </div>
      ),
    },
  ];
  const current = steps[step];
  const last = step === steps.length - 1;

  async function finish() {
    setSaving(true);
    try {
      localStorage.setItem("agora:voice", voice ? "on" : "off");
    } catch {
      /* storage blocked */
    }
    await updateProfile({ displayName: name.trim() || profile?.displayName || undefined, reason, dailyGoalMinutes: goal, voiceOn: voice, onboarded: true, ageConfirmed: true }).catch(() => {});
    router.replace("/home");
    start(topic);
  }

  return (
    <main className="flex min-h-screen flex-col bg-white">
      <header className="mx-auto flex w-full max-w-2xl items-center gap-4 px-5 pt-6">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-fg disabled:invisible"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex flex-1 gap-1.5" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-accent" : "bg-line"}`} />
          ))}
        </div>
        <LogoMark size={24} />
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pt-14 pb-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            <h1 className="display-xl text-[32px] leading-tight text-fg sm:text-[40px]">{current.title}</h1>
            <p className="mt-3 text-[17px] text-muted">{current.sub}</p>
            <div className="mt-9">{current.body}</div>
          </motion.div>
        </AnimatePresence>

        {last && (
          <label className="mt-10 flex cursor-pointer items-start gap-3 text-sm text-muted">
            <input type="checkbox" checked={ofAge} onChange={(e) => setOfAge(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
            <span>
              I&rsquo;m 13 or older and I agree to the{" "}
              <Link href="/terms" target="_blank" className="font-medium text-accent hover:underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="font-medium text-accent hover:underline">
                Privacy policy
              </Link>
              .
            </span>
          </label>
        )}

        <div className="mt-auto flex items-center justify-between pt-12">
          {step === 0 ? <span className="text-sm text-muted">Takes 30 seconds</span> : <span />}
          <button
            type="button"
            disabled={!current.ok || saving || (last && !ofAge)}
            onClick={() => (last ? finish() : setStep(step + 1))}
            className="btn-pill btn-pill-dark px-7 py-3 text-[15px]"
          >
            {last ? (saving ? "Starting…" : "Plan my course") : "Continue"}
          </button>
        </div>
      </div>
    </main>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border px-5 py-4 text-left text-[16px] font-medium text-fg transition-all ${
        on ? "border-accent bg-accent-soft/60 ring-2 ring-accent/25" : "border-line bg-white hover:border-line-strong hover:bg-canvas"
      }`}
    >
      {children}
    </button>
  );
}
