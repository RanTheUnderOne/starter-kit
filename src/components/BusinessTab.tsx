"use client";

import { Blocks, ShieldCheck, Sparkles } from "lucide-react";
import type { Role } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { IntegrationsTab } from "@/components/IntegrationsTab";

export function BusinessTab({ agentId, role }: { agentId: string; role: Role }) {
  const { t } = useLocale();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 px-4 pb-28 pt-7 sm:px-7 lg:px-10 lg:pb-12 lg:pt-10">
      <header>
        <p className="text-[11px] font-bold tracking-[0.2em] text-teal-700">{t("business.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-teal-950 sm:text-4xl">{t("business.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-teal-950/60">{t("business.subtitle")}</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        <Signal icon={Blocks} title="One view" body="Bring customer context together." />
        <Signal icon={Sparkles} title="Useful by default" body="Alfi reads what each job needs." />
        <Signal icon={ShieldCheck} title="Under your control" body="Disconnect any source at any time." />
      </div>
      <div className="alfi-panel rounded-[28px] p-5 sm:p-7"><IntegrationsTab agentId={agentId} role={role} embedded /></div>
    </div>
  );
}

function Signal({ icon: Icon, title, body }: { icon: typeof Blocks; title: string; body: string }) {
  return <div className="rounded-2xl border border-teal-950/8 bg-white/55 p-4"><Icon className="h-5 w-5 text-teal-700" /><h2 className="mt-3 text-sm font-semibold text-teal-950">{title}</h2><p className="mt-1 text-xs leading-5 text-teal-950/50">{body}</p></div>;
}
