"use client";

import { useState } from "react";
import { FileCode2, ServerCog } from "lucide-react";
import type { MergedAgent, Role } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { FilesTab } from "@/components/files/FilesTab";
import { AgentSettingsTab } from "@/components/AgentSettingsTab";
import { Button } from "@/components/ui/button";

export function AdvancedTab({ agentId, agent, role, onChanged }: { agentId: string; agent: MergedAgent; role: Role; onChanged: () => void }) {
  const { t } = useLocale();
  const [view, setView] = useState<"system" | "files">("system");
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-20 pt-7 sm:px-7 lg:px-10 lg:pt-10">
      <div>
        <p className="text-[11px] font-bold tracking-[0.2em] text-amber-700">{t("advanced.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-teal-950">{t("advanced.title")}</h1>
        <p className="mt-2 text-sm text-teal-950/55">{t("advanced.subtitle")}</p>
      </div>
      <div className="flex gap-2">
        <Button variant={view === "system" ? "default" : "outline"} onClick={() => setView("system")}><ServerCog className="h-4 w-4" />System</Button>
        <Button variant={view === "files" ? "default" : "outline"} onClick={() => setView("files")}><FileCode2 className="h-4 w-4" />Files</Button>
      </div>
      <div className="alfi-panel overflow-hidden rounded-[28px] p-5 sm:p-7">
        {view === "system" ? <AgentSettingsTab agentId={agentId} agent={agent} role={role} onChanged={onChanged} /> : <div className="h-[68vh]"><FilesTab agentId={agentId} /></div>}
      </div>
    </div>
  );
}
