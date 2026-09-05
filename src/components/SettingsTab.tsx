"use client";

import { useLocale } from "@/components/LocaleProvider";
import { BusinessProfile } from "@/components/BusinessProfile";

export function SettingsTab() {
  const { t } = useLocale();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 px-4 pb-28 pt-7 sm:px-7 lg:px-10 lg:pb-12 lg:pt-10">
      <header>
        <p className="alfi-eyebrow">{t("settings.eyebrow")}</p>
        <h1 className="alfi-page-title">{t("settings.title")}</h1>
        <p className="alfi-page-description">{t("settings.subtitle")}</p>
      </header>
      <BusinessProfile />
    </div>
  );
}
