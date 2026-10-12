"use client";

import type { CSSProperties, ReactNode } from "react";
import { useScrollReveal, type RevealOptions } from "@/hooks/useScrollReveal";

type Props = RevealOptions & {
  children: ReactNode;
  className?: string;
  /** Slide distance in px. */
  y?: number;
  /** Duration in ms. */
  duration?: number;
  as?: "div" | "section" | "header" | "li";
};

/** Fades + slides its children in once, when first scrolled into view. */
export function Reveal({ children, className = "", y = 12, duration = 500, as = "div", ...opts }: Props) {
  const ref = useScrollReveal<HTMLElement>(opts);
  const Tag = as;
  const style = { "--reveal-y": `${y}px`, "--reveal-dur": `${duration}ms` } as CSSProperties;
  return (
    <Tag ref={ref as never} className={`reveal ${className}`} style={style}>
      {children}
    </Tag>
  );
}
