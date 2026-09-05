"use client";

import type { Role } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { WhatsAppStatusSection } from "@/components/WhatsAppStatusSection";

export function WhatsAppTab({ agentId, role }: { agentId: string; role: Role }) {
  const { t, locale } = useLocale();
  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 px-4 pb-28 pt-7 sm:px-7 lg:px-10 lg:pb-12 lg:pt-10">
      <header>
        <p className="text-[11px] font-bold tracking-[0.2em] text-teal-700">{t("whatsapp.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">{locale === "he" ? "Alfi, גם בוואטסאפ" : "Alfi, on WhatsApp too"}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{locale === "he" ? "שני חיבורים נפרדים: אחד לעסק וללקוחות, ואחד לשיחות הפרטיות שלך עם Alfi." : "Two separate connections: one for your business and customers, and one for your private conversations with Alfi."}</p>
      </header>
      <WhatsAppStatusSection agentId={agentId} role={role} />
    </div>
  );
}
