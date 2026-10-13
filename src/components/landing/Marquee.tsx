"use client";

import { useAppState, useStartCourse } from "../app/AppState";
import { MARQUEE_ROWS } from "@/lib/catalog";
import { Kicker } from "./Primitives";

// Topics drifting across the page in two rows, each a button that starts
// that course. They're examples, not a list of what's on offer: Wondersity plans
// a course for anything you can name. They live in lib/catalog.ts, so they're
// seeded into the shared cache like the catalog and open at once.
const ROWS = MARQUEE_ROWS;

export function TopicMarquee() {
  const start = useStartCourse();
  const { busy } = useAppState();
  return (
    <section aria-label="Topics to try" className="overflow-hidden border-y border-line bg-white py-10 sm:py-14">
      <Kicker center>For work or for curiosity</Kicker>
      <div className="mt-6 space-y-1 sm:mt-8">
        {ROWS.map((row, r) => (
          <div key={r} className="marquee">
            <div className="marquee-track" data-reverse={r === 1 || undefined} style={{ "--marquee-dur": `${row.join("").length * 0.9}s` } as React.CSSProperties}>
              {[0, 1].map((copy) => (
                <div key={copy} className="flex items-center" aria-hidden={copy === 1 || undefined}>
                  {row.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      tabIndex={copy ? -1 : 0}
                      disabled={!!busy}
                      onClick={() => start(topic)}
                      className="display-xl flex items-center whitespace-nowrap px-4 py-1 text-[32px] text-fg/75 transition-colors duration-300 hover:text-accent sm:px-6 sm:text-[48px]"
                    >
                      {topic}
                      <span className="ml-8 h-1.5 w-1.5 rounded-full bg-accent/50 sm:ml-12 sm:h-2 sm:w-2" aria-hidden />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
