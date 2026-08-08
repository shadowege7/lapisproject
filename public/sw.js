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
  } catch (e) {
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
