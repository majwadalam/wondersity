"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { LogoMark } from "@/components/app/Brand";

// Route error boundary. The raw error stays in the console, never on screen.

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-canvas px-4 py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] max-w-[200vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,91,255,0.14),transparent)]"
      />
      <div className="relative flex max-w-md flex-col items-center text-center">
        <LogoMark size={44} />
        <h1 className="display-xl mt-6 text-[36px] text-fg sm:text-[44px]">Something went wrong</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted">
          We couldn&rsquo;t load this page. It&rsquo;s usually brief, so try again. Your courses and progress are saved.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn-pill btn-pill-dark">
            <RotateCcw className="h-4 w-4" aria-hidden /> Try again
          </button>
          <Link href="/" className="btn-pill bg-white text-fg ring-1 ring-line hover:bg-canvas">
            Home
          </Link>
        </div>
        {error.digest && <p className="mt-8 font-mono text-xs text-muted/70">Reference: {error.digest}</p>}
      </div>
    </main>
  );
}
