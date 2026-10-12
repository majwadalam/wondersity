"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// The learner's plan in Settings: which plan, what's used in the last 30 days,
// and a link to Paddle's portal to change or cancel it.

type Billing = {
  billingEnabled: boolean;
  plan: { tier: "free" | "paid"; plan?: "monthly" | "yearly"; until?: string | null; canceled?: boolean };
  usage: { lessons: number; painted: number; courses: number };
  limits: { windowDays: number; freeLessonsPerCourse: number; freeCourses: number; paidLessons: number; paintedLessons: number };
};

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

export function PlanSection({ upgraded }: { upgraded: boolean }) {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let stopped = false;
    let tries = 0;
    const load = async () => {
      const res = await fetch("/api/billing");
      const data = await res.json().catch(() => null);
      if (stopped) return;
      if (!res.ok || !data) return setError("Couldn't load your plan.");
      setBilling(data);
      // Just back from checkout: Paddle tells us a few seconds later, so check again.
      if (upgraded && data.plan.tier === "free" && ++tries < 6) setTimeout(load, 3000);
    };
    load();
    return () => {
      stopped = true;
    };
  }, [upgraded]);

  const manage = async () => {
    setOpening(true);
    setError("");
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.url) window.location.href = data.url;
    else {
      setError(data?.error ?? "Couldn't open billing.");
      setOpening(false);
    }
  };

  if (error && !billing) return <p className="text-sm text-bad">{error}</p>;
  if (!billing) return <div className="skeleton h-16 rounded-xl" />;
  if (!billing.billingEnabled) {
    return <p className="text-[15px] text-fg">Free during the beta, with no limits. Nothing is charged.</p>;
  }

  const { plan, usage, limits } = billing;
  const paid = plan.tier === "paid";
  return (
    <div className="space-y-4">
      {upgraded && !paid && <p className="text-sm text-muted">Confirming your payment with Paddle…</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-fg">{paid ? `Pro, ${plan.plan === "yearly" ? "yearly" : "monthly"}` : "Free"}</p>
          {paid && plan.until && (
            <p className="text-sm text-muted">{plan.canceled ? `Canceled; works until ${day(plan.until)}` : `Renews ${day(plan.until)}`}</p>
          )}
        </div>
        {paid ? (
          <button type="button" onClick={manage} disabled={opening} className="btn-secondary rounded-xl px-4 py-2.5 text-sm font-medium">
            {opening ? "Opening…" : "Manage billing"}
          </button>
        ) : (
          <Link href="/pricing" className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold">
            Upgrade
          </Link>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {paid ? (
          <>
            <Stat label="New lessons" value={`${usage.lessons} of ${limits.paidLessons}`} />
            <Stat label="Painted lessons" value={`${Math.min(usage.painted, limits.paintedLessons)} of ${limits.paintedLessons}`} />
          </>
        ) : (
          <>
            <Stat label="New courses" value={`${usage.courses} of ${limits.freeCourses}`} />
            <Stat label="Lessons per course" value={`First ${limits.freeLessonsPerCourse}`} />
          </>
        )}
      </dl>
      <p className="text-xs text-muted">Counted over the last {limits.windowDays} days.</p>
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-canvas px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold text-fg">{value}</dd>
    </div>
  );
}
