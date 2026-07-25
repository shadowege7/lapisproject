"use client";

import { useEffect, useState } from "react";
import {
  savePushSubscription,
  deletePushSubscription,
  sendTestNotification,
} from "./push-actions";

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

export function NotificationsToggle() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      setEnabled(!!sub);
    });
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      if (!VAPID_PUBLIC_KEY) {
        setMsg("Push notifications aren't configured on the server yet.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMsg(
          "Permission was blocked. Enable notifications for this site in your browser settings.",
        );
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
      });
      const json = sub.toJSON();
      const res = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });
      if (!res.ok) {
        setMsg(res.error ?? "Couldn't save the subscription.");
        return;
      }
      setEnabled(true);
      setMsg("Notifications enabled on this device.");
    } catch {
      setMsg("Couldn't enable notifications on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await sendTestNotification();
      setMsg(
        res.ok
          ? "Test notification sent — check your device."
          : (res.error ?? "Couldn't send a test notification."),
      );
    } catch {
      setMsg("Couldn't send a test notification.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setEnabled(false);
      setMsg("Notifications disabled on this device.");
    } catch {
      setMsg("Couldn't disable notifications on this device.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-sm text-zinc-500">
        This device or browser doesn&apos;t support push notifications. On
        iPhone/iPad, install the app to your Home Screen first, then open it
        from there.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={enabled ? disable : enable}
          disabled={busy}
          className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {busy
            ? "Working…"
            : enabled
              ? "Disable on this device"
              : "Enable on this device"}
        </button>
        {enabled ? (
          <button
            type="button"
            onClick={test}
            disabled={busy}
            className="w-fit rounded-md border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/40"
          >
            Send test notification
          </button>
        ) : null}
      </div>
      {msg ? <p className="text-sm text-zinc-500">{msg}</p> : null}
      <p className="text-xs text-zinc-400">
        You&apos;ll only receive notifications if an admin has turned them on for
        your account. If you have a main store, you&apos;re notified only for it;
        otherwise you&apos;re notified for every store you can access. Enable this
        on each device where you want alerts.
      </p>
    </div>
  );
}
