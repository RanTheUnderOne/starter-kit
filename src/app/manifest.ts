import type { MetadataRoute } from "next";
import { branding } from "@/config/branding";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: branding.appName,
    short_name: "Alphi",
    description: "Managed AI agents for your business",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfbfc",
    theme_color: "#2c6b5c",
    icons: [
      {
        src: "/icons/alphi-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/alphi-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
