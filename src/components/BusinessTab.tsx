"use client";

import type { Role } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { IntegrationsTab } from "@/components/IntegrationsTab";
import { WhatsAppStatusSection } from "@/components/WhatsAppStatusSection";

export function BusinessTab({ agentId, role }: { agentId: string; role: Role }) {
  const { t } = useLocale();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 px-4 pb-28 pt-7 sm:px-7 lg:px-10 lg:pb-12 lg:pt-10">
      <header>
        <p className="alfi-eyebrow">{t("business.eyebrow")}</p>
        <h1 className="alfi-page-title">{t("business.title")}</h1>
        <p className="alfi-page-description">{t("business.subtitle")}</p>
      </header>
      <WhatsAppStatusSection agentId={agentId} role={role} />
      <div className="pt-5">
        <h2 className="text-xl font-semibold">{t("business.appsTitle")}</h2>
        <p className="alfi-page-description">{t("business.appsSubtitle")}</p>
      </div>
      <IntegrationsTab agentId={agentId} role={role} embedded />
    </div>
  );
}
