"use client";

import { useEffect } from "react";
import { savePushSubscription } from "./account/push-actions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

/**
 * Runs once per app open, for users who have ALREADY granted notification
 * permission, and silently re-establishes their push subscription.
 *
 * Push subscriptions rotate/expire (iOS especially, also Android/FCM). The
 * server deletes dead subscriptions when a send returns 404/410, but nothing
 * recreated them, so notifications quietly stopped after a few days. This heals
 * that on every app open: it re-subscribes if the subscription is gone and
 * re-saves it, restoring any server-deleted row.
 *
 * It never prompts and never surfaces UI — it bails for anyone who hasn't
 * already opted in, and swallows every error. Renders nothing.
 */
export function PushRefresh() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (
          !("serviceWorker" in navigator) ||
          !("PushManager" in window) ||
          !("Notification" in window) ||
          Notification.permission !== "granted"
        ) {
          return;
        }
        if (!VAPID_PUBLIC_KEY) return;

        // Idempotent: returns the existing registration if already registered.
        await navigator.serviceWorker.register("/sw.js");
        const reg = await navigator.serviceWorker.ready;
        if (cancelled) return;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
          });
        }
        if (cancelled) return;

        const json = sub.toJSON();
        await savePushSubscription({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          userAgent: navigator.userAgent,
        });
      } catch {
        // Best-effort self-heal — never surface anything.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
