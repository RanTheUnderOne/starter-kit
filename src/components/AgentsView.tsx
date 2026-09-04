"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, MoreHorizontal, RotateCw, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { useLocale } from "@/components/LocaleProvider";
import { apiFetch } from "@/lib/api";
import { isTransitional, statusVariant } from "@/lib/format";
import { agentTabPath, shouldEnterAgentDirectly } from "@/lib/dashboard-tabs";
import type { MergedAgent, Role } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AgentNameCell } from "@/components/AgentNameCell";
import { CreateAgentButton } from "@/components/CreateAgentButton";
import { OpenPortButtons } from "@/components/OpenPortButtons";
import { AgentCard } from "@/components/AgentCard";
import { AgentOptionsMenu } from "@/components/AgentOptionsMenu";

export function AgentsView() {
  const { current, isStaff } = useWorkspace();
  const { t } = useLocale();
  const router = useRouter();
  const [agents, setAgents] = useState<MergedAgent[]>([]);
  const [role, setRole] = useState<Role>("admin");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!current) return;
    try {
      const data = await apiFetch<{ agents: MergedAgent[]; role: Role }>(
        `/api/agents?workspace=${current.id}`
      );
      setAgents(data.agents);
      setRole(data.role);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [current]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!agents.some((a) => isTransitional(a.live_status))) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [agents, load]);

  useEffect(() => {
    if (loading) return;
    if (shouldEnterAgentDirectly(isStaff, agents.length)) {
      router.replace(agentTabPath(agents[0].agent37_id, "chat"));
    }
  }, [agents, isStaff, loading, router]);

  if (!current) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (!loading && shouldEnterAgentDirectly(isStaff, agents.length)) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  const canCreate = isStaff || (role === "admin" && agents.length === 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("fleet.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("fleet.subtitle")}</p>
        </div>
        {canCreate && <CreateAgentButton workspaceId={current.id} onCreated={load} />}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : agents.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center bg-card">
          <p className="text-sm font-medium text-foreground">{t("fleet.empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("fleet.emptyBody")}</p>
        </div>
      ) : isStaff ? (
        <StaffFleetTable agents={agents} role={role} onChanged={load} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.agent37_id}
              agent={agent}
              role={role}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StaffFleetTable({
  agents,
  role,
  onChanged,
}: {
  agents: MergedAgent[];
  role: Role;
  onChanged: () => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Template</th>
            <th className="px-4 py-2 font-medium">Resources</th>
            <th className="px-4 py-2 text-right font-medium">Quick actions</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a.agent37_id} className="border-t [&>td]:align-middle">
              <td className="px-4 py-3">
                <AgentNameCell
                  agent={a}
                  canEdit={role === "admin"}
                  onRenamed={onChanged}
                  href={agentTabPath(a.agent37_id, "chat")}
                />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <Badge variant={statusVariant(a.live_status)}>{a.live_status ?? "unknown"}</Badge>
                  {a.past_due && <Badge variant="warning">past due</Badge>}
                </div>
                {a.status_reason && (
                  <div
                    className="mt-1 max-w-[16rem] truncate text-xs text-destructive"
                    title={a.status_reason.message}
                  >
                    {a.status_reason.message}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{a.template ?? "-"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {a.cpu} vCPU · {a.memory} GB · {a.disk} GB
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Button asChild variant="outline" size="sm" className="rounded-lg">
                    <Link href={agentTabPath(a.agent37_id, "chat")}>
                      <MessageSquare className="h-4 w-4" />
                      Chat
                    </Link>
                  </Button>
                  <OpenPortButtons
                    agentId={a.agent37_id}
                    ports={a.ports}
                    disabled={a.live_status !== "running"}
                    template={a.template}
                    size="sm"
                    className="justify-end"
                  />
                  {role === "admin" && <AgentOptionsMenu agent={a} onChanged={onChanged} />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
