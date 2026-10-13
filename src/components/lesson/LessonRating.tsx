"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";

// "Was this lesson good?" on the finish screen: one tap, and after a thumbs
// down an optional word about what was off. Lighter than reporting a mistake,
// so it's a signal on every lesson. Shown in the admin panel under Problems.

export function LessonRating({ lessonId }: { lessonId: number }) {
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  // A lesson rated before (reopened later) shows the learner's rating.
  useEffect(() => {
    let live = true;
    fetch(`/api/ratings?lessonId=${lessonId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d?.rating) return;
        setRating(d.rating.rating);
        setComment(d.rating.comment ?? "");
        setSent(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [lessonId]);

  async function save(next: 1 | -1, words?: string) {
    setRating(next);
    setError(false);
    const res = await fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, rating: next, ...(words ? { comment: words } : {}) }),
    }).catch(() => null);
    if (res?.ok) setSent(next === 1 || words !== undefined);
    else setError(true);
  }

  return (
    <div className="mt-6 rounded-2xl border border-line p-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm font-semibold text-fg">How was this lesson?</p>
        {([1, -1] as const).map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={rating === r}
            aria-label={r === 1 ? "Good lesson" : "Not great"}
            onClick={() => save(r)}
            className={`flex h-10 w-10 items-center justify-center rounded-full ring-1 transition-colors ${
              rating === r ? (r === 1 ? "bg-[#e9f8ef] text-good ring-good/30" : "bg-[#fdeeee] text-bad ring-bad/30") : "text-muted ring-line hover:text-fg"
            }`}
          >
            {r === 1 ? <ThumbsUp size={17} /> : <ThumbsDown size={17} />}
          </button>
        ))}
      </div>
      {rating === -1 && !sent && (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            save(-1, comment.trim());
          }}
        >
          <label htmlFor={`rating-${lessonId}`} className="sr-only">
            What was off?
          </label>
          <input
            id={`rating-${lessonId}`}
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            placeholder="What was off? (optional)"
            className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] text-fg outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
          />
          <button type="submit" className="btn-secondary rounded-xl px-4 py-2.5 text-sm font-medium">
            Send
          </button>
        </form>
      )}
      <p className="mt-2 text-xs text-muted" aria-live="polite">
        {error ? "Couldn't save that. Try again." : sent ? "Thanks: it helps us make better lessons." : ""}
      </p>
    </div>
  );
}
