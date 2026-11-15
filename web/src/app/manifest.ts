// Web app manifest: lets students install Sundial on their phone's home screen (PWA).
import type { MetadataRoute } from "next";
import { PRODUCT } from "@/components/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT,
    short_name: PRODUCT,
    description: `ASU Mobile shows your schedule. ${PRODUCT} plans your day.`,
    start_url: "/today",
    display: "standalone",
    background_color: "#dcebff",
    theme_color: "#dcebff",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
