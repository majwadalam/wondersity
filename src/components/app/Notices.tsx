"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { spring } from "@/components/motion/presets";
import { useAppState } from "./AppState";

// Toasts for errors and prompts: a fixed stack near the top of the window,
// over the page, so a notice never pushes the layout (a banner above a lesson
// used to shove the whole lesson down). Portaled to <body> because a lesson
// step's animation leaves a transform that would trap position: fixed.

const noSubscribe = () => () => {};
const useInBrowser = () => useSyncExternalStore(noSubscribe, () => true, () => false);

// An error closes itself after this long, unless the pointer is on it.
const ERROR_MS = 12_000;

export function Notices() {
  const inBrowser = useInBrowser();
  if (!inBrowser) return null;
  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-3 sm:top-5"
    >
      <AnimatePresence initial={false}>
        <ErrorToast key="error" />
        <UpgradeToast key="upgrade" />
        <EarlierProgressToast key="earlier" />
      </AnimatePresence>
    </div>,
    document.body
  );
}

export function ToastCard({
  tone,
  title,
  onClose,
  actions,
  children,
  onHover,
}: {
  tone: "warning" | "info";
  title: string;
  onClose?: () => void;
  actions?: ReactNode;
  children?: ReactNode;
  onHover?: (hovering: boolean) => void;
}) {
  return (
    <motion.div
      role={tone === "warning" ? "alert" : "status"}
      layout
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: spring.gentle }}
      exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.15 } }}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
      className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-line bg-surface/95 p-3.5 pr-2.5 shadow-[var(--shadow-lg)] backdrop-blur"
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          tone === "warning" ? "bg-[#fff4e5] text-[#b45309]" : "bg-accent-soft text-accent"
        }`}
      >
        {tone === "warning" ? "!" : "i"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-fg">{title}</p>
        {children && <div className="mt-0.5 text-[13px] leading-snug text-muted">{children}</div>}
        {actions && <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Close" className="-mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-fg">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>
      )}
    </motion.div>
  );
}

function ErrorToast() {
  const { error, clearError, retryLearn } = useAppState();
  const [hovering, setHovering] = useState(false);
  // The latest clearError, so the timer below isn't restarted on every render.
  const clear = useRef(clearError);
  useEffect(() => {
    clear.current = clearError;
  });
  useEffect(() => {
    if (!error || hovering) return;
    const timer = setTimeout(() => clear.current(), ERROR_MS);
    return () => clearTimeout(timer);
  }, [error, hovering]);
  if (!error) return null;
  return (
    <ToastCard
      tone="warning"
      title="We couldn’t prepare your lesson"
      onClose={clearError}
      onHover={setHovering}
      actions={
        retryLearn && error.retryable ? (
          <button type="button" onClick={retryLearn} className="btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold">
            Try again
          </button>
        ) : undefined
      }
    >
      {error.message}
      {error.ref && <span className="mt-1 block text-[11px] text-muted/70">Reference {error.ref}</span>}
    </ToastCard>
  );
}

function UpgradeToast() {
  const { upgrade, clearUpgrade } = useAppState();
  if (!upgrade) return null;
  return (
    <ToastCard
      tone="info"
      title="That lesson is part of Pro"
      onClose={clearUpgrade}
      actions={
        <Link href="/pricing" onClick={clearUpgrade} className="btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold">
          See plans
        </Link>
      }
    >
      {upgrade}
    </ToastCard>
  );
}

/** Asks before moving courses this browser made before accounts into the signed-in account. */
function EarlierProgressToast() {
  const { earlierProgress, resolveEarlierProgress } = useAppState();
  const [saving, setSaving] = useState(false);
  if (!earlierProgress) return null;
  const n = earlierProgress.courses.length;
  const names = earlierProgress.courses.slice(0, 3).map((c) => c.title || c.topic).join(", ");
  const decide = async (add: boolean) => {
    setSaving(true);
    await resolveEarlierProgress(add);
    setSaving(false);
  };
  return (
    <ToastCard
      tone="info"
      title={`Add your earlier ${n === 1 ? "course" : "courses"}?`}
      actions={
        <>
          <button type="button" disabled={saving} onClick={() => decide(true)} className="btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold">
            Add {n === 1 ? "it" : "them"}
          </button>
          <button type="button" disabled={saving} onClick={() => decide(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-canvas hover:text-fg">
            No thanks
          </button>
        </>
      }
    >
      This browser has {n === 1 ? "a course" : `${n} courses`} from before you had an account: {names}
      {n > 3 ? ` and ${n - 3} more` : ""}.
    </ToastCard>
  );
}
