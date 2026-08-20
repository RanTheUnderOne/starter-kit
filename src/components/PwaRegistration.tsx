"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error: unknown) => {
        console.error("Service worker registration failed:", error);
      });
  }, []);

  return null;
}
