"use client";

import { AVATARS, avatarSrc, type AvatarId } from "@/lib/avatars";

/** The painted avatars to choose from (Settings and onboarding); "Default" is the Google photo or the initial. */
export function AvatarPicker({ value, onChange, className = "" }: { value: AvatarId | null; onChange: (id: AvatarId | null) => void; className?: string }) {
  return (
    <div className={`grid grid-cols-4 gap-3 sm:grid-cols-7 ${className}`}>
      <button
        type="button"
        aria-pressed={!value}
        title="Your Google photo, or your initial"
        onClick={() => onChange(null)}
        className={`flex aspect-square items-center justify-center rounded-full bg-canvas text-center text-xs font-medium leading-tight text-muted ring-offset-2 transition hover:text-fg ${
          !value ? "ring-2 ring-accent" : "ring-1 ring-line hover:ring-accent/50"
        }`}
      >
        Default
      </button>
      {AVATARS.map((a) => (
        <button
          key={a.id}
          type="button"
          aria-pressed={value === a.id}
          aria-label={a.name}
          title={a.name}
          onClick={() => onChange(a.id)}
          className={`overflow-hidden rounded-full ring-offset-2 transition ${value === a.id ? "ring-2 ring-accent" : "ring-1 ring-line hover:ring-accent/50"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- small static WebP */}
          <img src={avatarSrc(a.id)} alt="" width={128} height={128} loading="lazy" className="aspect-square w-full object-cover" />
        </button>
      ))}
    </div>
  );
}
