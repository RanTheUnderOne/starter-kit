"use client";

import type { Role } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { TabHeader } from "@/components/TabHeader";
import { WhatsAppStatusSection } from "@/components/WhatsAppStatusSection";

export function WhatsAppTab({ agentId, role }: { agentId: string; role: Role }) {
  const { t } = useLocale();
  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 px-4 pt-7 sm:px-7 lg:px-10 lg:pt-10">
      <TabHeader
        eyebrow={t("whatsapp.eyebrow")}
        title={t("whatsapp.title")}
        subtitle={t("whatsapp.subtitle")}
      />
      <WhatsAppStatusSection agentId={agentId} role={role} />
    </div>
  );
}
