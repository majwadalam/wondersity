"use client";

/** Topic field: border + ring on focus. `bare` drops the border for use inside a card that provides its own. */
export function TopicInput({
  value,
  onChange,
  bare = false,
}: {
  value: string;
  onChange: (value: string) => void;
  bare?: boolean;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor="topic" className="sr-only">
        Topic
      </label>
      <input
        id="topic"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Try “the fall of Rome” or “Stoicism”"
        autoComplete="off"
        maxLength={120}
        className={`${bare ? "topic-input-bare" : "topic-input"} w-full px-3 py-3.5 text-base text-fg`}
      />
    </div>
  );
}
