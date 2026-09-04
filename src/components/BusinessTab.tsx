"use client";

import { Blocks, ShieldCheck, Sparkles } from "lucide-react";
import type { Role } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { TabHeader } from "@/components/TabHeader";
import { IntegrationsTab } from "@/components/IntegrationsTab";

export function BusinessTab({ agentId, role }: { agentId: string; role: Role }) {
  const { t } = useLocale();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 px-4 pt-7 sm:px-7 lg:px-10 lg:pt-10">
      <TabHeader
        eyebrow={t("business.eyebrow")}
        title={t("business.title")}
        subtitle={t("business.subtitle")}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Signal icon={Blocks} title="One view" body="Bring customer context together." />
        <Signal icon={Sparkles} title="Useful by default" body="Alfi reads what each job needs." />
        <Signal icon={ShieldCheck} title="Under your control" body="Disconnect any source at any time." />
      </div>
      <div className="alfi-panel rounded-2xl p-5 sm:p-7"><IntegrationsTab agentId={agentId} role={role} embedded /></div>
    </div>
  );
}

function Signal({ icon: Icon, title, body }: { icon: typeof Blocks; title: string; body: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-xs">
      <Icon className="h-5 w-5 text-primary" />
      <h2 className="mt-3 text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  );
}
