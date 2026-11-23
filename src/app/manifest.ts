import type { MetadataRoute } from "next";
import { getCanonicalSiteUrl } from "@/lib/env/public";

/** Generated at /manifest.webmanifest. All icons are original VARSITY artwork. */
export default function manifest(): MetadataRoute.Manifest {
  const siteUrl = getCanonicalSiteUrl();
  const icon = (name: string, sizes: string, purpose?: "any" | "maskable") => ({
    src: new URL(`/icons/${name}`, siteUrl).toString(),
    sizes,
    type: "image/png",
    ...(purpose ? { purpose } : {}),
  });

  return {
    id: "/",
    name: "VARSITY — College PE Management Platform",
    short_name: "VARSITY",
    description:
      "The College Physical Education Department platform for students, PE staff and event organisers.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#F4F2E9",
    theme_color: "#101D2C",
    lang: "en",
    dir: "ltr",
    categories: ["education", "sports", "productivity"],
    icons: [
      icon("icon-192.png", "192x192", "any"),
      icon("icon-512.png", "512x512", "any"),
      icon("icon-maskable-512.png", "512x512", "maskable"),
    ],
    screenshots: [
      {
        src: new URL("/icons/screenshot-wide.png", siteUrl).toString(),
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
      },
      {
        src: new URL("/icons/screenshot-narrow.png", siteUrl).toString(),
        sizes: "750x1334",
        type: "image/png",
        form_factor: "narrow",
      },
    ],
    shortcuts: [
      {
        name: "Games",
        short_name: "Games",
        description: "Play and view VARSITY games",
        url: "/games",
        icons: [icon("icon-192.png", "192x192")],
      },
      {
        name: "Game Rules",
        short_name: "Rules",
        description: "Read published sports rules",
        url: "/game-rules",
        icons: [icon("icon-192.png", "192x192")],
      },
    ],
  };
}
