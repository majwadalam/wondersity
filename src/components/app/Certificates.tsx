"use client";

import { Award } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export type CertificateSummary = { id: string; course_id: number; course_title: string; completed_at: string; lessons: number };

/** The learner's certificates (the server issues any a completed course is missing). */
export function useCertificates(enabled = true) {
  const [list, setList] = useState<CertificateSummary[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    fetch("/api/certificates")
      .then((r) => (r.ok ? r.json() : { certificates: [] }))
      .then((d) => live && setList(d.certificates ?? []))
      .catch(() => live && setList([]));
    return () => {
      live = false;
    };
  }, [enabled]);
  return list;
}

/** Progress → Certificates: one card per completed course, each opening its shareable page. */
export function CertificateList() {
  const list = useCertificates();
  if (!list?.length) return null;
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl text-fg">Certificates</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <Link key={c.id} href={`/certificate/${c.id}`} className="shadow-card group flex items-center gap-4 rounded-2xl bg-white p-4 transition-transform hover:-translate-y-0.5">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7a5cff] to-[#3aa0e8] text-white">
              <Award size={22} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold text-fg">{c.course_title}</span>
              <span className="block text-xs text-muted">
                {c.lessons} lessons · {new Date(c.completed_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </span>
              <span className="mt-1 block text-xs font-medium text-accent">View and share →</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
