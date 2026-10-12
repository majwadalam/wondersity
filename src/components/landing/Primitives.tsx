"use client";

import { useMotionValue, useReducedMotion, useScroll, type MotionValue } from "motion/react";
import type { ReactNode, RefObject } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

// The landing page's shared typography and scroll pieces.

/** A small mono label above a heading, with an optional running number. */
export function Kicker({
  index,
  children,
  dark = false,
  center = false,
}: {
  index?: string;
  children: ReactNode;
  dark?: boolean;
  center?: boolean;
}) {
  return (
    <p
      className={`flex items-center gap-3 font-mono text-[12px] tracking-[0.18em] uppercase ${center ? "justify-center" : ""} ${
        dark ? "text-accent-on-dark" : "text-accent-strong"
      }`}
    >
      {index && <span className={`tabular-nums ${dark ? "text-white/70" : "text-muted"}`}>{index}</span>}
      {children}
    </p>
  );
}

/**
 * A heading revealed line by line: each line rises out of its own clipped box
 * the first time it scrolls into view (CSS does the motion; `useScrollReveal`
 * only marks the element). Lines are given by hand so the reveal has shape.
 */
export function Lines({
  lines,
  as: Tag = "h2",
  className = "",
  delay = 0,
  id,
}: {
  lines: ReactNode[];
  as?: "h1" | "h2" | "p";
  className?: string;
  /** Entrance delay in ms when visible on load. */
  delay?: number;
  id?: string;
}) {
  const ref = useScrollReveal<HTMLElement>({ delay });
  return (
    <Tag ref={ref as never} id={id} className={`lines ${className}`}>
      {lines.map((line, i) => (
        <span key={i} className="line-clip">
          <span className="line" style={{ transitionDelay: `calc(var(--reveal-delay, 0ms) + ${i * 90}ms)` }}>
            {line}
          </span>
        </span>
      ))}
    </Tag>
  );
}

/** A word or two in the accent colour, inside a heading. */
export const Em = ({ children, dark = false }: { children: ReactNode; dark?: boolean }) => (
  <span className={dark ? "text-accent-on-dark" : "text-accent-strong"}>{children}</span>
);

/** A section's opening: number and label, the heading, and a line of body text beside it. */
export function SectionHead({
  index,
  eyebrow,
  lines,
  body,
  dark = false,
  center = false,
  size = "lg",
}: {
  index: string;
  eyebrow: string;
  lines: ReactNode[];
  body?: string;
  dark?: boolean;
  center?: boolean;
  /** "md" for a heading in a narrow column. */
  size?: "lg" | "md";
}) {
  const heading = (
    <Lines
      lines={lines}
      className={`display-xl mt-4 ${size === "lg" ? "text-[38px] sm:text-[54px] lg:text-[64px]" : "text-[34px] sm:text-[44px] lg:text-[52px]"} ${
        dark ? "text-white" : "text-fg"
      }`}
    />
  );
  if (center) {
    return (
      <div className="mx-auto max-w-4xl text-center">
        <Kicker index={index} dark={dark} center>
          {eyebrow}
        </Kicker>
        {heading}
        {body && <p className={`mx-auto mt-5 max-w-xl text-[17px] leading-relaxed sm:text-[19px] ${dark ? "text-white/65" : "text-muted"}`}>{body}</p>}
      </div>
    );
  }
  const head = (
    <div>
      <Kicker index={index} dark={dark}>
        {eyebrow}
      </Kicker>
      {heading}
    </div>
  );
  if (!body) return head;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-16">
      {head}
      <p className={`max-w-md text-[17px] leading-relaxed sm:text-[19px] lg:pb-2 ${dark ? "text-white/65" : "text-muted"}`}>{body}</p>
    </div>
  );
}

type Offset = NonNullable<Parameters<typeof useScroll>[0]>["offset"];

/**
 * Scroll progress (0 to 1) of an element through the viewport, for motion
 * that follows the scroll. With reduced motion on it stays at 1: the end
 * state, nothing moving.
 */
export function useScrub(target: RefObject<HTMLElement | null>, offset: Offset): MotionValue<number> {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target, offset });
  const still = useMotionValue(1);
  return reduced ? still : scrollYProgress;
}
