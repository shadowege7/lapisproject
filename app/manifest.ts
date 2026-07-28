import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lapis Automotive Group Sales Tracker",
    short_name: "Lapis Sales",
    description:
      "Daily, monthly, and annual sales tracking for Lapis Automotive Group",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1d4ed8",
    icons: [
      { src: "/icon-192.png?v=3", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png?v=3", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png?v=3",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
