// Placeholders shaped like what they stand in for, so a page keeps its layout
// while the learner's data arrives and nothing jumps when it does. Each one is
// one status for screen readers; the bones themselves are hidden.

type Props = { className?: string };

/** One grey shape. Sized by its className. */
export function Bone({ className = "" }: Props) {
  return <span aria-hidden className={`skeleton block ${className}`} />;
}

/** Announces loading once, for the whole placeholder. */
function Loading({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Home: the "Continue" card. */
export function ContinueSkeleton() {
  return (
    <Loading label="Loading your next lesson" className="flex min-h-[260px] flex-col justify-end rounded-2xl bg-white p-7 ring-1 ring-line">
      <Bone className="h-3 w-44" />
      <Bone className="mt-3 h-7 w-3/5" />
      <Bone className="mt-3 h-4 w-4/5 max-w-md" />
      <span className="mt-6 flex items-center gap-4">
        <Bone className="h-10 w-40 rounded-full" />
        <Bone className="h-3.5 w-20" />
      </span>
    </Loading>
  );
}

/** Home: today's goal ring and the streak. */
export function TodaySkeleton() {
  return (
    <Loading label="Loading today's progress" className="flex min-h-[260px] flex-col rounded-2xl bg-white p-6 ring-1 ring-line">
      <Bone className="h-4 w-12" />
      <div className="mt-4 flex items-center gap-5">
        <span aria-hidden className="h-20 w-20 flex-shrink-0 rounded-full border-8 border-line" />
        <div className="flex-1">
          <Bone className="h-7 w-24" />
          <Bone className="mt-2 h-3.5 w-20" />
        </div>
      </div>
      <div className="mt-auto flex items-center gap-3 border-t border-line pt-4">
        <Bone className="h-9 w-9 rounded-full" />
        <div className="flex-1">
          <Bone className="h-3.5 w-24" />
          <Bone className="mt-1.5 h-3 w-44" />
        </div>
      </div>
    </Loading>
  );
}

/** A course tile: art, topic, title, description, progress. */
function TileBones() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <Bone className="aspect-[16/10] rounded-none" />
      <div className="flex flex-1 flex-col p-5">
        <Bone className="h-3 w-16" />
        <Bone className="mt-2.5 h-5 w-4/5" />
        <Bone className="mt-3 h-3 w-full" />
        <Bone className="mt-1.5 h-3 w-2/3" />
        <div className="mt-auto pt-5">
          <div className="flex justify-between">
            <Bone className="h-3 w-20" />
            <Bone className="h-3 w-8" />
          </div>
          <Bone className="mt-2 h-2 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** A grid of course tiles, in the grid the real tiles use. */
export function CourseTilesSkeleton({ count = 4, className = "" }: { count?: number; className?: string }) {
  return (
    <Loading label="Loading your courses" className={className}>
      {Array.from({ length: count }, (_, i) => (
        <TileBones key={i} />
      ))}
    </Loading>
  );
}

/** A course's page: header, progress card, the world and its road. */
export function CoursePageSkeleton() {
  return (
    <Loading label="Loading the course" className="mx-auto max-w-[1080px] px-5 pt-8 pb-24">
      <Bone className="h-4 w-20" />
      <div className="mt-5 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="max-w-2xl">
          <Bone className="h-3.5 w-48" />
          <Bone className="mt-3 h-11 w-4/5" />
          <Bone className="mt-4 h-4 w-full" />
          <Bone className="mt-2 h-4 w-3/4" />
        </div>
        <div className="shadow-card rounded-3xl bg-white p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <span aria-hidden className="h-16 w-16 flex-shrink-0 rounded-full border-[6px] border-line" />
            <div className="flex-1">
              <Bone className="h-6 w-16" />
              <Bone className="mt-2 h-3.5 w-24" />
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Bone className="h-3 w-12" />
                <Bone className="h-2 flex-1 rounded-full" />
              </div>
            ))}
          </div>
          <Bone className="mt-5 h-11 w-full rounded-full" />
        </div>
      </div>
      <div className="relative mt-8 aspect-[21/9] min-h-[240px] overflow-hidden rounded-3xl bg-canvas ring-1 ring-line">
        <Bone className="absolute inset-0 rounded-none" />
        {/* The road and its stops, faint, so the shape of the journey is there before the painting. */}
        <svg viewBox="0 0 100 42" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <path d="M4 32 C 22 30, 26 14, 44 18 S 70 34, 96 12" fill="none" stroke="var(--line-strong)" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {[
          [8, 75],
          [30, 47],
          [52, 50],
          [72, 66],
          [91, 33],
        ].map(([x, y]) => (
          <span key={x} aria-hidden className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-4 ring-line" style={{ left: `${x}%`, top: `${y}%` }} />
        ))}
      </div>
    </Loading>
  );
}

/** A lesson: the player's top bar, one step, and the bottom bar. */
export function LessonSkeleton() {
  return (
    <Loading label="Loading the lesson" className="min-h-screen bg-surface">
      <div className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4 sm:px-6">
          <Bone className="h-9 w-9 rounded-lg" />
          <div className="flex flex-1 gap-1">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} aria-hidden className="h-2 flex-1 rounded-full bg-canvas ring-1 ring-line ring-inset" />
            ))}
          </div>
          <Bone className="h-3.5 w-10" />
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
        <Bone className="h-3 w-28" />
        <Bone className="mt-4 h-9 w-4/5" />
        <Bone className="mt-8 h-4 w-full" />
        <Bone className="mt-2.5 h-4 w-11/12" />
        <Bone className="mt-2.5 h-4 w-4/5" />
        <Bone className="mt-8 aspect-[16/9] w-full rounded-2xl" />
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface">
        <div className="mx-auto flex h-[72px] max-w-3xl items-center justify-between px-4 sm:px-6">
          <Bone className="h-11 w-24 rounded-xl" />
          <Bone className="h-11 w-32 rounded-xl" />
        </div>
      </div>
    </Loading>
  );
}

/** Review: a missed check, with its four options. */
export function ReviewSkeleton() {
  return (
    <Loading label="Loading your mistakes" className="mt-10">
      <Bone className="h-4 w-40" />
      <div className="mt-3 space-y-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl bg-white p-5 ring-1 ring-line sm:p-6">
            <Bone className="h-3 w-36" />
            <Bone className="mt-3 h-5 w-full" />
            <Bone className="mt-2 h-5 w-2/3" />
            <div className="mt-5 space-y-2.5">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-line">
                  <Bone className="h-7 w-7 rounded-lg" />
                  <Bone className={`h-3.5 ${["w-3/5", "w-2/5", "w-1/2", "w-1/3"][j]}`} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** Settings: title, tabs and the Profile section. */
export function SettingsSkeleton() {
  return (
    <Loading label="Loading your settings" className="mx-auto max-w-2xl px-5 pt-10 pb-24 sm:px-8">
      <Bone className="h-9 w-36" />
      <div className="mt-9 flex h-[41px] items-center gap-1 border-b border-line">
        {["w-14", "w-10", "w-24", "w-16"].map((w) => (
          <Bone key={w} className={`mx-4 h-3.5 ${w}`} />
        ))}
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="mt-5 rounded-2xl bg-white p-6 ring-1 ring-line">
          <Bone className="h-4 w-24" />
          {i === 0 ? (
            <>
              <div className="mt-5 flex items-center gap-4">
                <Bone className="h-14 w-14 rounded-full" />
                <div className="flex-1">
                  <Bone className="h-4 w-32" />
                  <Bone className="mt-2 h-3.5 w-48" />
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <Bone className="h-11 flex-1 rounded-xl" />
                <Bone className="h-11 w-16 rounded-xl" />
              </div>
            </>
          ) : (
            <div className="mt-5 flex gap-2">
              {[0, 1, 2, 3].map((j) => (
                <Bone key={j} className="h-10 w-20 rounded-full" />
              ))}
            </div>
          )}
        </div>
      ))}
    </Loading>
  );
}

/** Settings → Plan: the plan's name, its renewal and the action. */
export function PlanSkeleton() {
  return (
    <Loading label="Loading your plan" className="flex items-center justify-between gap-3">
      <div>
        <Bone className="h-4 w-24" />
        <Bone className="mt-2 h-3.5 w-36" />
      </div>
      <Bone className="h-10 w-32 rounded-full" />
    </Loading>
  );
}

/** Progress: the list of courses, one row each. */
export function CourseRowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Loading label="Loading your courses" className="mt-4 divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Bone className="h-14 w-24 flex-shrink-0 rounded-lg" />
          <div className="flex-1">
            <Bone className={`h-4 ${["w-48", "w-36", "w-56"][i % 3]}`} />
            <div className="mt-2.5 flex items-center gap-3">
              <Bone className="h-1.5 max-w-[240px] flex-1 rounded-full" />
              <Bone className="h-3 w-8" />
            </div>
          </div>
        </div>
      ))}
    </Loading>
  );
}
