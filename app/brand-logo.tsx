"use client";

import { useState } from "react";
import { BrandLockup } from "./brand";

/**
 * The LAPIS wordmark.
 *
 * Two files rather than one on a white chip: the artwork is dark navy and used
 * to need a white plate behind it to survive a dark background, which put a
 * bright rectangle in the middle of every dark screen. There is now a white
 * copy for dark mode, so the mark sits directly on whatever is behind it.
 *
 * Both are rendered and one is hidden by CSS rather than picking in JavaScript:
 * the theme is a class on <html>, so a component that chose at render time
 * would flash the wrong one on first paint.
 *
 * Falls back to the monogram lockup if the files are missing.
 */
export function BrandLogo({ className = "h-9" }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) return <BrandLockup />;

  return (
    <span className="inline-flex items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/lapis-wordmark.png"
        alt="Lapis Automotive Group"
        className={`${className} w-auto dark:hidden`}
        onError={() => setFailed(true)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/lapis-wordmark-white.png"
        alt=""
        aria-hidden
        className={`${className} hidden w-auto dark:block`}
      />
    </span>
  );
}
