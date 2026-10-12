"use client";

import { useInView, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useRef } from "react";

// lottie-web needs `document` when it loads, so the player is client-only.
// The light build draws SVG and has no expressions (all our files work in it).
const Player = dynamic(() => import("lottie-react").then((m) => m.LottieLight), { ssr: false });

/**
 * A decorative Lottie animation from /public/lottie. It loads only when it
 * comes near the screen and plays once (anything moving longer than five
 * seconds would need a pause button, WCAG 2.2.2). With reduced motion on it
 * doesn't play at all.
 */
export function Lottie({
  name,
  loop = false,
  className = "",
  label,
}: {
  /** File name in /public/lottie, without ".json". */
  name: string;
  /** Only for animations shorter than five seconds in total. */
  loop?: boolean | number;
  className?: string;
  /** Set only if the animation carries meaning; otherwise it's hidden from screen readers. */
  label?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const near = useInView(box, { once: true, margin: "200px" });
  const reduce = useReducedMotion();

  return (
    <div ref={box} className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {near && (
        <Player
          src={`/lottie/${name}.json`}
          loop={reduce ? false : loop}
          autoplay={!reduce}
          rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </div>
  );
}
