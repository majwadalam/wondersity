"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAppState, useStartCourse } from "@/components/app/AppState";

export function StartFromLink({ topic }: { topic: string }) {
  const { signedIn, loaded } = useAppState();
  const start = useStartCourse();
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || signedIn === null || (signedIn && !loaded)) return;
    done.current = true;
    if (!topic) return router.replace(signedIn ? "/home" : "/");
    // Signed in, the dialog (or the course) opens over Home.
    if (signedIn) router.replace("/home");
    start(topic);
  }, [signedIn, loaded, topic, router, start]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent-soft border-t-accent" aria-hidden />
      <p className="mt-4 text-muted">{topic ? <>Opening &ldquo;{topic}&rdquo;…</> : "Opening Wondersity…"}</p>
    </main>
  );
}
