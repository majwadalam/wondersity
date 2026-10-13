"use client";

import { Award, Bell, BookOpen, CalendarCheck, Clock, Flame } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Item = { id: number; kind: "lesson_ready" | "streak" | "certificate" | "reminder"; title: string; body: string; href: string | null; read_at: string | null; created_at: string };

const ICON = { lesson_ready: BookOpen, streak: Flame, certificate: Award, reminder: Clock, recap: CalendarCheck } as const;
const TINT = { lesson_ready: "bg-accent-soft text-accent", streak: "bg-[#fff1e6] text-[#f2711c]", certificate: "bg-[#e9f8ef] text-good", reminder: "bg-canvas text-muted", recap: "bg-accent-soft text-accent" } as const;

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * The bell: what the app has to tell the learner (a lesson ready, a streak
 * milestone, a certificate, a reminder). Refreshed every minute and when the
 * tab comes back; opening it marks everything read.
 */
export function NotificationBell({ align = "left" }: { align?: "left" | "right" }) {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications").catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    setItems(data.notifications ?? []);
    setUnread(data.unread ?? 0);
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 60_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      void fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-canvas hover:text-fg"
      >
        <Bell size={19} strokeWidth={1.9} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white ring-2 ring-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className={`step-sheet absolute top-11 z-50 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-lg)] ring-1 ring-line ${align === "left" ? "left-0" : "right-0"}`}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-fg">Notifications</p>
            <Link href="/settings?tab=notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-accent hover:underline">
              Settings
            </Link>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm leading-relaxed text-muted">
              Nothing yet. You&rsquo;ll hear here when a lesson is ready, when you reach a streak milestone and when you earn a certificate.
            </p>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto py-1">
              {items.map((n) => {
                const Icon = ICON[n.kind];
                const body = (
                  <span className="flex gap-3 px-4 py-3">
                    <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${TINT[n.kind]}`}>
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm ${n.read_at ? "font-medium text-fg" : "font-semibold text-fg"}`}>{n.title}</span>
                        <span className="flex-shrink-0 text-[11px] text-muted">{ago(n.created_at)}</span>
                      </span>
                      {n.body && <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-muted">{n.body}</span>}
                    </span>
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-accent" aria-label="New" />}
                  </span>
                );
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link href={n.href} onClick={() => setOpen(false)} className="block hover:bg-canvas">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
