import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgriHome Vision Console",
    short_name: "AgriHome",
    description:
      "Mobile-first tray and plant health monitoring with schedules, reports, and mesh management.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef3e8",
    theme_color: "#eef3e8",
    orientation: "portrait",
    icons: [
      {
        src: "/pwa-icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      },
      {
        src: "/pwa-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
