"use client";

import Link from "next/link";
import { useState } from "react";
import { useAppState } from "@/components/app/AppState";
import { HoverArrow } from "@/components/landing/HoverArrow";

// Opens Paddle's checkout for one plan. Paddle charges the learner and then
// tells our webhook, which unlocks the plan; the learner id rides along in
// customData so the webhook knows whose plan it is.

type PaddleGlobal = {
  Environment: { set: (env: string) => void };
  Initialize: (options: { token: string }) => void;
  Checkout: {
    open: (options: {
      items: { priceId: string; quantity: number }[];
      customer?: { email: string };
      customData?: Record<string, string>;
      discountCode?: string;
      settings?: { successUrl?: string; displayMode?: string };
    }) => void;
  };
};

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

const SCRIPT = "https://cdn.paddle.com/paddle/v2/paddle.js";
let ready: Promise<PaddleGlobal> | null = null;

function loadPaddle(): Promise<PaddleGlobal> {
  ready ??= new Promise((resolve, reject) => {
    const init = () => {
      const paddle = window.Paddle;
      if (!paddle) return reject(new Error("Checkout didn't load."));
      if (process.env.NEXT_PUBLIC_PADDLE_ENV !== "production") paddle.Environment.set("sandbox");
      paddle.Initialize({ token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "" });
      resolve(paddle);
    };
    if (window.Paddle) return init();
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = init;
    script.onerror = () => {
      ready = null;
      reject(new Error("Checkout couldn't load. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return ready;
}

export function CheckoutButton({ priceId, label, className }: { priceId: string; label: string; className?: string }) {
  const { signedIn, learnerId, profile } = useAppState();
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);

  if (signedIn === false) {
    return (
      <Link href="/login?mode=signup" className={className}>
        {label} <HoverArrow />
      </Link>
    );
  }

  const open = async () => {
    setError("");
    setOpening(true);
    try {
      // The creator who referred the learner: their code rides along so the
      // webhook can credit them, and their audience discount is applied.
      const [paddle, billing] = await Promise.all([loadPaddle(), fetch("/api/billing").then((r) => (r.ok ? r.json() : null)).catch(() => null)]);
      const referral: { code: string; discountCode: string | null } | null = billing?.referral ?? null;
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        ...(profile?.email ? { customer: { email: profile.email } } : {}),
        ...(referral?.discountCode ? { discountCode: referral.discountCode } : {}),
        customData: { learnerId, ...(referral ? { ref: referral.code } : {}) },
        settings: { successUrl: `${window.location.origin}/settings?upgraded=1` },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout couldn't open.");
    } finally {
      setOpening(false);
    }
  };

  return (
    <>
      <button type="button" onClick={open} disabled={opening || !learnerId} className={className}>
        {opening ? "Opening checkout…" : label} {!opening && <HoverArrow />}
      </button>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
    </>
  );
}
