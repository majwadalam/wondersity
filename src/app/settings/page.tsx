"use client";

import { useState } from "react";
import { NotificationSettings } from "@/components/app/NotificationSettings";
import { Avatar } from "@/components/app/AppShell";
import { useAppState } from "@/components/app/AppState";
import { PlanSection } from "@/components/billing/PlanSection";

// Account settings: plan, name, daily goal, voice; signing out; deleting everything.

const GOALS = [5, 10, 20, 30];

export default function SettingsPage() {
  const { profile, updateProfile, signOut, refresh } = useAppState();
  const [name, setName] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Back from Paddle's checkout (its success URL adds ?upgraded=1).
  const [upgraded] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("upgraded"));

  if (!profile) {
    return (
      <main className="mx-auto max-w-2xl px-5 pt-10 sm:px-8">
        <div className="skeleton h-96 rounded-2xl" />
      </main>
    );
  }

  const save = async (patch: Parameters<typeof updateProfile>[0], what: string) => {
    setSaved("");
    await updateProfile(patch);
    if (patch.voiceOn !== undefined) {
      try {
        localStorage.setItem("agora:voice", patch.voiceOn ? "on" : "off");
      } catch {
        /* storage blocked */
      }
    }
    setSaved(what);
  };

  async function deleteEverything() {
    setDeleting(true);
    const res = await fetch("/api/account/claim", { method: "DELETE" });
    if (res.ok) {
      await refresh();
      await signOut();
    } else {
      setDeleting(false);
      setSaved("Couldn't delete your data. Try again.");
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 pt-10 pb-24 sm:px-8">
      <h1 className="display-xl text-[34px] text-fg">Settings</h1>
      <p aria-live="polite" className="mt-2 h-5 text-sm text-good">
        {saved && `${saved} saved.`}
      </p>

      <Section title="Plan">
        <PlanSection upgraded={upgraded} />
      </Section>

      <Section title="Profile">
        <div className="flex items-center gap-4">
          <Avatar size={56} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-fg">{profile.displayName || "No name yet"}</p>
            <p className="truncate text-sm text-muted">{profile.email}</p>
          </div>
        </div>
        <form
          className="mt-5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name !== null) save({ displayName: name.trim() }, "Name");
          }}
        >
          <label htmlFor="name" className="sr-only">
            Name
          </label>
          <input
            id="name"
            value={name ?? profile.displayName ?? ""}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            placeholder="Your name"
            className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] text-fg outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
          />
          <button type="submit" disabled={name === null} className="btn-secondary rounded-xl px-4 text-sm font-medium">
            Save
          </button>
        </form>
      </Section>

      <Section title="Daily goal" note="Shown on Home as a ring to fill each day.">
        <div className="grid grid-cols-4 gap-2">
          {GOALS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={profile.dailyGoalMinutes === m}
              onClick={() => save({ dailyGoalMinutes: m }, "Daily goal")}
              className={`rounded-xl border py-3 text-sm font-medium transition-colors ${
                profile.dailyGoalMinutes === m ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-white text-fg hover:bg-canvas"
              }`}
            >
              {m} min
            </button>
          ))}
        </div>
      </Section>

      <Section title="Voice" note="Your guide reads each step aloud. You can also switch it off inside a lesson.">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="text-[15px] text-fg">Guide speaks</span>
          <input
            type="checkbox"
            role="switch"
            checked={profile.voiceOn}
            onChange={(e) => save({ voiceOn: e.target.checked }, "Voice")}
            className="toggle"
          />
        </label>
      </Section>

      <div id="notifications" className="scroll-mt-20">
        <Section title="Notifications" note="The bell in the app shows these too.">
          <NotificationSettings />
        </Section>
      </div>

      <Section title="Account">
        <form action="/auth/signout" method="post" onSubmit={(e) => (e.preventDefault(), signOut())}>
          <button type="submit" className="btn-secondary rounded-xl px-4 py-2.5 text-sm font-medium">
            Sign out
          </button>
        </form>
      </Section>

      <Section
        title="Delete your data"
        note="Removes every course, lesson, answer and setting. This can't be undone. It doesn't cancel a paid plan: cancel that first in Manage billing."
        danger
      >
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={deleteEverything} disabled={deleting} className="rounded-xl bg-bad px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {deleting ? "Deleting…" : "Yes, delete everything"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-xl px-4 py-2.5 text-sm text-muted hover:text-fg">
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="rounded-xl border border-bad/40 px-4 py-2.5 text-sm font-medium text-bad hover:bg-[#fdeeee]">
            Delete my data
          </button>
        )}
      </Section>
    </main>
  );
}

function Section({ title, note, danger, children }: { title: string; note?: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <section className={`mt-5 rounded-2xl bg-white p-6 ring-1 ${danger ? "ring-bad/25" : "ring-line"}`}>
      <h2 className={`text-[15px] font-semibold ${danger ? "text-bad" : "text-fg"}`}>{title}</h2>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
