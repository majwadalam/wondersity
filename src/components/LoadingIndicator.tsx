"use client";


/** 2px indeterminate bar pinned to the top of the viewport. */
export function TopProgressBar() {
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-[2px] overflow-hidden bg-line" role="progressbar" aria-label="Preparing lesson">
      <div className="progress-indeterminate h-full w-1/3 bg-accent" />
    </div>
  );
}
