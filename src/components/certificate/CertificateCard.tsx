"use client";

import "@fontsource/fraunces/400-italic.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/600-italic.css";
import { useId } from "react";
import { LogoMark } from "../app/Brand";

export type CertificateView = {
  id: string;
  learnerName: string;
  courseTitle: string;
  topic: string;
  levels: string[];
  lessons: number;
  minutes: number;
  accuracy: number | null;
  completedAt: string;
};

export const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const serif = { fontFamily: "Fraunces, Georgia, serif" } as const;

/** "A, B and C". */
export const listOf = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/** The seal: a rosette in the brand colours, with the mark at its centre and its words around the rim. */
function Seal({ size = 112 }: { size?: number }) {
  // size 0: fill the box it's placed in (the certificate sizes it in fractions of its width).
  const id = useId().replace(/:/g, "");
  const points = 28;
  const star = Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? 46 : 50;
    const a = (Math.PI * i) / points - Math.PI / 2;
    // Rounded, so the server and the browser draw the same points (no hydration mismatch).
    return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 100" width={size || "100%"} height={size || "100%"} aria-hidden className="drop-shadow-[0_6px_14px_rgba(99,91,255,0.35)]">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7a5cff" />
          <stop offset="1" stopColor="#3aa0e8" />
        </linearGradient>
        <path id={`${id}c`} d="M50,50 m-33,0 a33,33 0 1,1 66,0 a33,33 0 1,1 -66,0" />
      </defs>
      <polygon points={star} fill={`url(#${id}g)`} />
      <circle cx="50" cy="50" r="41" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="0.6" />
      <circle cx="50" cy="50" r="25" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="0.6" />
      <text fill="white" fontSize="6.4" fontWeight="600" letterSpacing="1.6">
        <textPath href={`#${id}c`}>WONDERSITY · CERTIFIED COMPLETION ·</textPath>
      </text>
      <g transform="translate(36.5 36.5) scale(0.84)">
        <circle cx="11.5" cy="16" r="9.5" fill="white" />
        <circle cx="20.5" cy="16" r="9.5" fill="white" fillOpacity="0.6" />
      </g>
    </svg>
  );
}


/** A size in hundredths of the certificate's width, so the whole sheet scales like a document. */
const w = (n: number) => `${n}cqw`;

/**
 * The certificate as a document, at the standard size: A4 landscape
 * (1.414 : 1) at every width. Type, spacing and the seal are sized in
 * fractions of the sheet's width (container query units), so it scales as a
 * whole and nothing reflows: on a phone it is a smaller copy of the same
 * sheet. Everything on it comes from saved completions.
 */
export function CertificateCard({ c, verifyUrl, qr }: { c: CertificateView; verifyUrl: string; qr: string }) {
  const id = useId().replace(/:/g, "");
  const scope = c.levels.length ? `${c.lessons} interactive lessons in ${c.levels.length} levels: ${listOf(c.levels)}.` : `${c.lessons} interactive lessons.`;
  const inset = (n: number) => ({ top: w(n), left: w(n), right: w(n), bottom: w(n) });
  return (
    <article
      className="certificate relative aspect-[1.414/1] w-full overflow-hidden rounded-[0.6cqw] bg-[#fffdf9] shadow-[0_0_0_1px_rgba(10,37,64,0.06),0_2px_4px_rgba(10,37,64,0.06),0_30px_60px_-24px_rgba(10,37,64,0.28)]"
      style={{ containerType: "inline-size" }}
      aria-label={`Certificate: ${c.learnerName} completed ${c.courseTitle}`}
    >
      {/* A fine engraved pattern behind everything, like security paper. */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1000 707" aria-hidden>
        <defs>
          <radialGradient id={`${id}fade`}>
            <stop offset="0" stopColor="#635bff" stopOpacity="0.09" />
            <stop offset="1" stopColor="#635bff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1000" height="707" fill={`url(#${id}fade)`} />
        {Array.from({ length: 26 }, (_, i) => (
          <ellipse key={i} cx="500" cy="354" rx={80 + i * 22} ry={40 + i * 13} fill="none" stroke="#635bff" strokeOpacity={0.05} strokeWidth="1" transform={`rotate(${i * 7} 500 354)`} />
        ))}
      </svg>
      {/* The double rule, and its corners. */}
      <div className="pointer-events-none absolute border-[#0a2540]/80" style={{ ...inset(1.6), borderWidth: w(0.16) }} aria-hidden />
      <div className="pointer-events-none absolute border-[#0a2540]/20" style={{ ...inset(2.5), borderWidth: w(0.1) }} aria-hidden />
      {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((corner) => {
        const [v, h] = corner.split("-") as ["top" | "bottom", "left" | "right"];
        return <span key={corner} className="absolute block rotate-45 bg-accent" style={{ [v]: w(1.25), [h]: w(1.25), width: w(0.75), height: w(0.75) }} aria-hidden />;
      })}

      <div className="relative flex h-full flex-col" style={{ padding: `${w(5)} ${w(6.5)} ${w(4.6)}` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: w(0.8) }}>
            <LogoMark size={24} />
            <span className="font-semibold tracking-[-0.03em] text-fg" style={{ fontSize: w(1.8) }}>
              wondersity
            </span>
          </div>
          <span className="font-mono text-muted" style={{ fontSize: w(1.15) }}>
            No. {c.id}
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="font-semibold tracking-[0.34em] text-accent uppercase" style={{ fontSize: w(1.25) }}>
            Certificate of completion
          </p>
          <p className="text-muted italic" style={{ ...serif, fontSize: w(1.8), marginTop: w(2) }}>
            This is to certify that
          </p>
          <h1 className="font-semibold tracking-[-0.01em] text-[#0a2540]" style={{ ...serif, fontSize: w(5.6), lineHeight: 1.05, marginTop: w(0.6) }}>
            {c.learnerName}
          </h1>
          <div className="flex items-center" style={{ gap: w(1.2), marginTop: w(1.5) }} aria-hidden>
            <span className="bg-[#0a2540]/25" style={{ height: 1, width: w(12) }} />
            <span className="block rotate-45 bg-accent" style={{ width: w(0.65), height: w(0.65) }} />
            <span className="bg-[#0a2540]/25" style={{ height: 1, width: w(12) }} />
          </div>
          <p className="text-muted italic" style={{ ...serif, fontSize: w(1.8), marginTop: w(1.5) }}>
            has successfully completed the course
          </p>
          <h2 className="font-semibold text-[#0a2540] italic" style={{ ...serif, fontSize: w(3.2), lineHeight: 1.2, marginTop: w(0.6), maxWidth: w(78) }}>
            {c.courseTitle}
          </h2>
          <p className="text-muted" style={{ fontSize: w(1.45), marginTop: w(1.1), maxWidth: w(70) }}>
            {scope}
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end" style={{ gap: w(2) }}>
          <div className="min-w-0 text-left">
            <p className="text-[#0a2540]" style={{ ...serif, fontSize: w(1.8) }}>
              {longDate(c.completedAt)}
            </p>
            <div className="bg-[#0a2540]/30" style={{ height: 1, width: w(18), marginTop: w(0.6) }} />
            <p className="tracking-wide text-muted uppercase" style={{ fontSize: w(1.15), marginTop: w(0.6) }}>
              Date of completion
            </p>
          </div>
          <div className="flex justify-center" style={{ width: w(11) }}>
            <Seal size={0} />
          </div>
          <div className="flex min-w-0 items-end justify-end" style={{ gap: w(1.6) }}>
            <div className="min-w-0 text-right">
              <p className="leading-none text-[#0a2540] italic" style={{ ...serif, fontSize: w(2.3) }}>
                Wondersity
              </p>
              <div className="ml-auto bg-[#0a2540]/30" style={{ height: 1, width: w(14), marginTop: w(0.6) }} />
              <p className="tracking-wide text-muted uppercase" style={{ fontSize: w(1.15), marginTop: w(0.6) }}>
                Scan to verify
              </p>
            </div>
            {/* Opens this certificate's page, where anyone can check it. Generated on the server from its address. */}
            <div className="flex-shrink-0 [&_svg]:h-full [&_svg]:w-full" style={{ width: w(7.2), height: w(7.2) }} title={verifyUrl} aria-label={`QR code: ${verifyUrl}`} role="img" dangerouslySetInnerHTML={{ __html: qr }} />
          </div>
        </div>
      </div>
    </article>
  );
}
