import Link from "next/link";
import { LogoMark } from "@/components/app/Brand";
import { HoverArrow } from "@/components/landing/HoverArrow";

export default function NotFound() {
  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-canvas px-4 py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] max-w-[200vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,91,255,0.16),transparent)]"
      />
      <div className="relative flex max-w-md flex-col items-center text-center">
        <LogoMark size={44} />
        <p className="mt-6 font-mono text-sm font-medium tracking-wide text-accent">404</p>
        <h1 className="display-xl mt-2 text-[36px] text-fg sm:text-[44px]">This page wandered off</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted">
          The link may be old, or the address mistyped. Your courses and progress are safe; head back and pick up where you left off.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/home" className="btn-pill btn-pill-dark">
            Go to your courses <HoverArrow />
          </Link>
          <Link href="/" className="btn-pill bg-white text-fg ring-1 ring-line hover:bg-canvas">
            Wondersity home
          </Link>
        </div>
      </div>
    </main>
  );
}
