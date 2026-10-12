"use client";

import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { EASE_OUT, duration, spring } from "./presets";

/**
 * Content that opens and closes by animating its height (hints,
 * explanations, module details). Children unmount when closed.
 */
export function Expand({ open, children, className = "" }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="expand"
          className={`overflow-hidden ${className}`}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1, transition: { height: spring.gentle, opacity: { duration: duration.base, delay: 0.05 } } }}
          exit={{ height: 0, opacity: 0, transition: { duration: duration.fast, ease: EASE_OUT } }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * A progress bar whose fill springs to `value` (0-1). Uses scaleX, not width,
 * so it never triggers layout.
 */
export function ProgressFill({ value, className = "", label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className={`h-1.5 overflow-hidden rounded-full bg-fg/15 ${className}`}
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(v * 100) : undefined}
    >
      <motion.div
        className="h-full origin-left rounded-full bg-accent"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: v }}
        transition={spring.follow}
      />
    </div>
  );
}

/**
 * A number that counts up to `value` once `active` is true. Renders through a
 * motion value, so it doesn't re-render React on every frame.
 */
export function CountUp({ value, active, format }: { value: number; active: boolean; format: (n: number) => string }) {
  const reduce = useReducedMotion();
  const v = useMotionValue(0);
  const text = useTransform(v, (n) => format(n));
  // A timed tween, not a spring: a spring only approaches its target, so a
  // million could settle on "999,999". The tween lands exactly on the value.
  useEffect(() => {
    if (!active) return;
    const controls = animate(v, value, { duration: reduce ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [active, value, v, reduce]);
  return <motion.span>{text}</motion.span>;
}

const BURST_PARTICLES = 10;

/**
 * A small, one-shot burst of particles around its parent (which should be
 * `position: relative`). Renders nothing with reduced motion. Fires each time
 * `trigger` changes to a new truthy value; particles unmount when done.
 */
export function Burst({ trigger, tone = "gold" }: { trigger: unknown; tone?: "gold" | "sage" }) {
  const reduce = useReducedMotion();
  const [shots, setShots] = useState<number[]>([]);
  const [last, setLast] = useState<unknown>(trigger);

  // Derive a new shot during render when the trigger changes (no effect needed).
  if (trigger !== last) {
    setLast(trigger);
    if (trigger && !reduce) setShots((s) => [...s, Date.now()]);
  }

  useEffect(() => {
    if (shots.length === 0) return;
    const t = setTimeout(() => setShots((s) => s.slice(1)), 900);
    return () => clearTimeout(t);
  }, [shots]);

  const color = tone === "gold" ? "var(--accent)" : "var(--good)";
  return (
    <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" aria-hidden>
      {shots.map((id) =>
        Array.from({ length: BURST_PARTICLES }, (_, i) => {
          const angle = (i / BURST_PARTICLES) * Math.PI * 2 + (id % 7) * 0.2;
          const dist = 34 + (i % 3) * 12;
          return (
            <motion.span
              key={`${id}-${i}`}
              className="absolute h-1.5 w-1.5 rounded-full"
              style={{ background: color }}
              initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
              animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, scale: [0.4, 1.1, 0], opacity: [1, 1, 0] }}
              transition={{ duration: 0.7, ease: EASE_OUT }}
            />
          );
        })
      )}
    </span>
  );
}
