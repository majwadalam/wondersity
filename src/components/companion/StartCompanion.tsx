"use client";

import { useEffect } from "react";
import { useAppState, useStartCourse } from "@/components/app/AppState";
import { HoverArrow } from "@/components/landing/HoverArrow";
import { rememberRefInBrowser } from "@/lib/referrals";

// The companion page's button: credits the creator (first referral wins) and
// starts the course, through sign-up first when signed out.

export function StartCompanion({ topic, partnerCode, label = "Start the course" }: { topic: string; partnerCode: string; label?: string }) {
  const start = useStartCourse();
  const { busy, courseFor } = useAppState();
  useEffect(() => rememberRefInBrowser(partnerCode), [partnerCode]);
  const existing = courseFor(topic);
  return (
    <button type="button" onClick={() => start(topic)} disabled={!!busy} className="btn-pill btn-pill-accent px-7 py-3 text-[15px]">
      {busy ? "Planning your course…" : existing ? "Continue the course" : label} {!busy && <HoverArrow />}
    </button>
  );
}
