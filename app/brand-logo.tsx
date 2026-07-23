"use client";

import { useState } from "react";
import { BrandLockup } from "./brand";

/**
 * Renders the Lapis logo image on a white chip so the dark navy artwork stays
 * visible on both light and dark backgrounds. Falls back to the monogram
 * wordmark if the image file (public/lapis-logo.png) is missing.
 */
export function BrandLogo({
  className = "h-9",
}: {
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) return <BrandLockup />;

  return (
    <span className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-black/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/lapis-logo.png"
        alt="Lapis Automotive Group"
        className={`${className} w-auto`}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
