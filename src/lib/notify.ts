// One place that tells a learner something: a notification for the bell, and
// a browser push if they turned those on. Never throws: telling them must not
// break the lesson or quiz that caused it.

import { insertNotification, type NotificationKind } from "./db";
import { sendPush } from "./push";

export async function notify(
  learnerId: string,
  n: { kind: NotificationKind; title: string; body: string; href: string },
  { push = true, asServer = false }: { push?: boolean; asServer?: boolean } = {}
) {
  await insertNotification(learnerId, n, asServer).catch((e) => console.error("notify:", e));
  if (push) await sendPush(learnerId, { title: n.title, body: n.body, url: n.href, tag: n.kind }, asServer).catch((e) => console.error("notify push:", e));
}
