import Link from "next/link";
import { useId } from "react";

/**
 * The Wondersity mark: two overlapping circles, two minds in dialogue. Where
 * they meet is the brightest part.
 */
export function LogoMark({ size = 28, light = false }: { size?: number; light?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden className="flex-shrink-0">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7a5cff" />
          <stop offset="1" stopColor="#635bff" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6ec3f4" />
          <stop offset="1" stopColor="#3aa0e8" />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <circle cx="11.5" cy="16" r="9.5" />
        </clipPath>
      </defs>
      <circle cx="11.5" cy="16" r="9.5" fill={`url(#${id}a)`} />
      <circle cx="20.5" cy="16" r="9.5" fill={`url(#${id}b)`} />
      {/* Where the circles meet: the page colour, so it reads on light and dark. */}
      <circle cx="20.5" cy="16" r="9.5" fill={light ? "#ffffff" : "#0a2540"} clipPath={`url(#${id}c)`} />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-semibold tracking-[-0.03em] text-fg ${className}`}>wondersity</span>;
}

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Wondersity home">
      <LogoMark light={light} />
      <Wordmark className={`text-[21px] ${light ? "!text-white" : ""}`} />
    </Link>
  );
}
