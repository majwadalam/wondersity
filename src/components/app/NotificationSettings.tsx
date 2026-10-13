"use client";

import { useEffect, useState } from "react";
import { useAppState } from "./AppState";
import { disablePush, enablePush, pushState } from "./push";

/**
 * Settings → Notifications: browser notifications on this device (lesson
 * ready, certificate, streak milestones, the daily reminder), and whether the
 * daily streak reminder and the weekly recap are sent at all. The bell in the app works either way.
 */
export function NotificationSettings() {
  const { profile, updateProfile } = useAppState();
  const [state, setState] = useState<"on" | "off" | "blocked" | "unsupported" | "loading">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    pushState().then((s) => live && setState(s)).catch(() => live && setState("unsupported"));
    return () => {
      live = false;
    };
  }, []);

  async function toggle(on: boolean) {
    setBusy(true);
    try {
      if (on) setState(await enablePush());
      else {
        await disablePush();
        setState("off");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span>
          <span className="block text-[15px] text-fg">Browser notifications</span>
          <span className="mt-0.5 block text-sm text-muted">
            {state === "blocked"
              ? "Blocked in this browser. Allow notifications for this site in your browser's settings, then turn this on."
              : state === "unsupported"
                ? "This browser can't show notifications from Wondersity."
                : "On this device: when a lesson is ready, a streak milestone, a certificate, and the reminder below."}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={state === "on"}
          disabled={busy || state === "loading" || state === "unsupported" || state === "blocked"}
          onChange={(e) => toggle(e.target.checked)}
          className="toggle"
        />
      </label>
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span>
          <span className="block text-[15px] text-fg">Reminders and weekly recap</span>
          <span className="mt-0.5 block text-sm text-muted">
            One nudge in the evening, only on a day you haven&rsquo;t learned yet and only while you have a streak. And on Sunday evening, your week: lessons, minutes and what&rsquo;s next.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={profile?.reminders ?? true}
          onChange={(e) => updateProfile({ reminders: e.target.checked })}
          className="toggle"
        />
      </label>
    </div>
  );
}
