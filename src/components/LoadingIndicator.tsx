"use client";


/** 2px indeterminate bar pinned to the top of the viewport. */
export function TopProgressBar() {
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-[2px] overflow-hidden bg-line" role="progressbar" aria-label="Preparing lesson">
      <div className="progress-indeterminate h-full w-1/3 bg-accent" />
    </div>
  );
}

export function LessonSkeleton() {
  return (
    <div className="animate-fade-in mt-10 space-y-4 rounded-3xl border border-line/70 bg-surface/70 p-6 sm:p-8" aria-hidden>
      <div className="skeleton h-3 w-24" />
      <div className="skeleton h-8 w-4/5" />
      <div className="skeleton h-4 w-3/5" />
      <div className="pt-4" />
      <div className="skeleton h-3 w-full" />
      <div className="skeleton h-3 w-11/12" />
      <div className="skeleton h-3 w-9/12" />
    </div>
  );
}
