import type { Metadata } from "next";
import { Suspense } from "react";
import { HelpForm } from "./HelpForm";

export const metadata: Metadata = {
  title: "Help — Wondersity",
  description: "Answers to common questions, and a way to reach a person.",
};

const FAQ: [string, string][] = [
  ["Where's my next lesson?", "Open the course from Courses or Home. Your next lesson is written while you take the one before, so it usually opens at once; a new one takes a minute or two."],
  ["A lesson has a mistake in it", "Press the flag in the lesson's top bar and say what's wrong. It goes to us with the screen you were on."],
  ["I got a check wrong. Can I try again?", "Yes: Review, in the sidebar, lists every check you missed. Your first answer keeps its grade; getting it right now clears it."],
  ["Can I change my guide's voice?", "Yes. On the course page, under Voices in this course, pick another voice for anyone who speaks in it."],
  ["How do streaks work?", "A day counts when you finish a lesson. One missed day a week is forgiven automatically, so a busy day doesn't end your streak."],
  ["How do I get my data, or delete it?", "Settings → Your data downloads everything we keep about you. Settings → Delete your data removes it."],
];

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 pt-16 pb-24">
      <h1 className="display-xl font-display text-4xl text-fg sm:text-5xl">Help</h1>
      <p className="mt-3 text-lg text-muted">Quick answers first. If yours isn&rsquo;t here, write to us below: a person reads every message.</p>

      <section className="mt-10 divide-y divide-line rounded-2xl bg-white ring-1 ring-line" aria-label="Common questions">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group px-5 py-4 sm:px-6">
            <summary className="cursor-pointer list-none font-medium text-fg">
              <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90">›</span>
              {q}
            </summary>
            <p className="mt-2 pl-4 text-[15px] leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </section>

      <section className="mt-10 rounded-2xl bg-white p-5 ring-1 ring-line sm:p-6" aria-labelledby="contact">
        <h2 id="contact" className="text-[15px] font-semibold text-fg">
          Write to us
        </h2>
        <Suspense>
          <HelpForm />
        </Suspense>
      </section>
    </main>
  );
}
