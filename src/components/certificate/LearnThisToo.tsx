"use client";

import { useStartCourse } from "../app/AppState";

/** For someone who opened a shared certificate: take the same course. */
export function LearnThisToo({ topic }: { topic: string }) {
  const start = useStartCourse();
  return (
    <section className="flex flex-col rounded-3xl bg-navy p-6 text-white">
      <p className="text-sm text-white/70">Curious?</p>
      <p className="mt-1 text-lg font-semibold">Learn {topic} on Wondersity</p>
      <p className="mt-1 mb-5 text-sm text-white/70">Short interactive lessons with painted scenes and a guide. Free during the beta.</p>
      <button type="button" onClick={() => start(topic)} className="btn-pill mt-auto self-start bg-white text-fg hover:bg-white/90">
        Start this course
      </button>
    </section>
  );
}
