import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lapis Automotive Group Sales Tracker",
    short_name: "Lapis Sales",
    description:
      "Daily, monthly, and annual sales tracking for Lapis Automotive Group",
    start_url: "/",
    display: "standalone",
    // Pantone 296 C, so the splash screen and status bar match the icon
    // rather than flashing white before the app paints.
    background_color: "#041e42",
    theme_color: "#041e42",
    // The version bump matters: an installed app keeps its old icon
    // indefinitely otherwise, and would sit on the home screen in gold.
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
