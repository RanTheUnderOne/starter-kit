"use client";

import { Languages } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

export function LanguageToggle({
  compact = false,
  tone = "light",
}: {
  compact?: boolean;
  tone?: "light" | "dark";
}) {
  const { locale, setLocale, t } = useLocale();
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "en" ? "he" : "en")}
      aria-label={t("language.label")}
      className={
        tone === "dark"
          ? "inline-flex h-9 items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 text-xs font-semibold text-white/78 transition hover:bg-white/12 hover:text-white"
          : "inline-flex h-9 items-center gap-2 rounded-full border border-teal-950/10 bg-white/80 px-3 text-xs font-semibold text-teal-900 transition hover:bg-white"
      }
    >
      <Languages className="h-3.5 w-3.5" />
      {!compact && t("language.switch")}
    </button>
  );
}

