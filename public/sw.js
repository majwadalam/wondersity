// Wondersity's service worker: shows browser notifications (lib/push.ts sends
// them) and opens the right page when one is clicked. It does nothing else:
// no caching, no offline mode. A push isn't shown while the learner has the
// app open in front of them; the bell in the app shows it there.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Wondersity", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      if (windows.some((w) => w.focused && w.visibilityState === "visible")) return;
      return self.registration.showNotification(data.title || "Wondersity", {
        body: data.body || "",
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag: data.tag,
        data: { url: data.url || "/home" },
      });
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/home", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) return open.navigate(url).then((w) => (w || open).focus());
      return self.clients.openWindow(url);
    })
  );
});
