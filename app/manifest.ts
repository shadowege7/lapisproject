import type { MetadataRoute } from "next";
import { APP_NAME, COMPANY_NAME } from "@/app/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${COMPANY_NAME} ${APP_NAME}`,
    // Kept short: this is the label under the icon on a home screen, and
    // anything longer than about twelve characters is truncated there.
    short_name: APP_NAME,
    description:
      "Daily, monthly, and annual sales figures for Lapis Automotive Group",
    start_url: "/",
    display: "standalone",
    // Pantone 296 C, so the splash screen and status bar match the icon
    // rather than flashing white before the app paints.
    background_color: "#041e42",
    theme_color: "#041e42",
    // The version bump matters: an installed app keeps its old icon
    // indefinitely otherwise, and would sit on the home screen in gold.
    //
    // Note it does nothing for the *name* above. A phone caches the launcher
    // label from when the app was installed, so anyone with it already on
    // their home screen keeps seeing the old one until they reinstall.
    icons: [
      { src: "/icon-192.png?v=5", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png?v=5", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png?v=5",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
