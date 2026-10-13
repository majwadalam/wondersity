// Browser push (Web Push with VAPID keys, the `web-push` package): no outside
// service. A learner turns it on in Settings; the browser's subscription is
// saved (push_subscriptions) and the service worker (public/sw.js) shows what's
// sent. Without keys configured, pushing is skipped quietly.

import webpush from "web-push";
import { deletePushSubscription, listPushSubscriptions } from "./db";
import { env } from "./env";

let configured: boolean | null = null;

function ready() {
  if (configured !== null) return configured;
  const publicKey = env("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const privateKey = env("VAPID_PRIVATE_KEY");
  // Who push services can contact about these pushes: an https: or mailto: address. The site's
  // own address in production; a placeholder in development, where the site is plain http.
  const site = env("NEXT_PUBLIC_SITE_URL");
  const subject = env("VAPID_SUBJECT") || (site?.startsWith("https://") ? site : "mailto:push@localhost");
  configured = !!(publicKey && privateKey);
  if (configured) {
    try {
      webpush.setVapidDetails(subject, publicKey!, privateKey!);
    } catch (e) {
      console.error("push disabled:", e instanceof Error ? e.message : e);
      configured = false;
    }
  }
  return configured;
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/**
 * Pushes to every browser the learner turned notifications on in. Expired
 * subscriptions (404/410) are removed. Never throws.
 */
export async function sendPush(learnerId: string, payload: PushPayload, asServer = false) {
  if (!ready()) return 0;
  let sent = 0;
  try {
    const subs = await listPushSubscriptions(learnerId, asServer);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
          sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await deletePushSubscription(s.endpoint, asServer).catch(() => {});
          else console.error("push failed:", status, e instanceof Error ? e.message : e);
        }
      })
    );
  } catch (e) {
    console.error("push:", e);
  }
  return sent;
}
