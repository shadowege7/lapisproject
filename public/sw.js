// Service worker for Web Push notifications.

// Take over promptly so an updated worker's notification behaviour reaches
// people on their next push, rather than only after every tab is closed.
self.addEventListener("install", function () {
  self.skipWaiting();
});
self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Lapis Sales Tracker";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag,
    data: { url: data.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// The browser can rotate a push subscription in the background (iOS especially,
// also Android/FCM). When it does, the old endpoint stops working. Re-subscribe
// and tell the server the new endpoint so notifications keep arriving without
// the user reopening the app. Errors are swallowed; the app-open self-heal
// recovers anything missed here.
self.addEventListener("pushsubscriptionchange", function (event) {
  event.waitUntil(
    (async function () {
      try {
        let sub = event.newSubscription;
        if (!sub) {
          // Reuse the old subscription's application server key so this worker
          // needs no embedded VAPID key. If it isn't available, bail — the
          // self-heal on next app open will re-establish the subscription.
          const applicationServerKey =
            event.oldSubscription &&
            event.oldSubscription.options &&
            event.oldSubscription.options.applicationServerKey;
          if (!applicationServerKey) return;
          sub = await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey,
          });
        }
        if (!sub) return;

        const json = sub.toJSON();
        await fetch("/api/push/subscribe", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            p256dh: (json.keys && json.keys.p256dh) || "",
            auth: (json.keys && json.keys.auth) || "",
            oldEndpoint: event.oldSubscription && event.oldSubscription.endpoint,
          }),
        });
      } catch {
        // Best-effort — swallow.
      }
    })(),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url =
    (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        // Reuse an open app window: navigate it to the target so it reloads
        // with the latest numbers — navigate() reloads even when it's already
        // on that page — then focus it. So a click always shows fresh data,
        // not whatever was on screen when the push arrived. If navigate isn't
        // available (or is refused for an uncontrolled window), fall back to a
        // plain focus.
        for (const client of clientList) {
          if ("focus" in client) {
            if ("navigate" in client) {
              return client
                .navigate(url)
                .then(function (navigated) {
                  return (navigated || client).focus();
                })
                .catch(function () {
                  return client.focus();
                });
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      }),
  );
});
