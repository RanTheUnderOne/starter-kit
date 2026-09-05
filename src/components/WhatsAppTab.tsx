"use client";

import type { Role } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { WhatsAppStatusSection } from "@/components/WhatsAppStatusSection";

export function WhatsAppTab({ agentId, role }: { agentId: string; role: Role }) {
  const { t } = useLocale();
  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 px-4 pb-28 pt-7 sm:px-7 lg:px-10 lg:pb-12 lg:pt-10">
      <header>
        <p className="text-[11px] font-bold tracking-[0.2em] text-muted-foreground">{t("whatsapp.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">{t("whatsapp.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("whatsapp.subtitle")}</p>
      </header>
      <WhatsAppStatusSection agentId={agentId} role={role} />
    </div>
  );
}
