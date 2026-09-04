"use client";

import Link from "next/link";
import { MessageSquare, Sparkles } from "lucide-react";
import type { MergedAgent, Role } from "@/lib/types";
import { agentTabPath } from "@/lib/dashboard-tabs";
import { statusVariant } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OpenPortButtons } from "@/components/OpenPortButtons";
import { AgentOptionsMenu } from "@/components/AgentOptionsMenu";

export function AgentCard({
  agent,
  role,
  onChanged,
}: {
  agent: MergedAgent;
  role: Role;
  onChanged?: () => void;
}) {
  const name = agent.name?.trim() || "Alfi Assistant";
  const running = agent.live_status === "running";

  return (
    <div className="alfi-panel flex flex-col justify-between rounded-2xl p-5 sm:p-6 transition hover:shadow-md">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary font-bold text-sm">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <Link
                href={agentTabPath(agent.agent37_id, "chat")}
                className="block truncate text-base font-semibold text-foreground hover:underline"
              >
                {name}
              </Link>
              <p className="truncate text-xs text-muted-foreground">{agent.template || "Agent37 Managed"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant={statusVariant(agent.live_status)} className="rounded-full">
              {agent.live_status ?? "unknown"}
            </Badge>
            {agent.past_due && <Badge variant="warning" className="rounded-full">past due</Badge>}
          </div>
        </div>

        {agent.status_reason && (
          <div
            className="mt-2.5 truncate text-xs text-destructive bg-destructive/10 rounded-lg px-2.5 py-1"
            title={agent.status_reason.message}
          >
            {agent.status_reason.message}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5">
            {agent.cpu} vCPU
          </span>
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5">
            {agent.memory} GB RAM
          </span>
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5">
            {agent.disk} GB Disk
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t pt-4">
        <Button asChild size="sm" className="rounded-lg">
          <Link href={agentTabPath(agent.agent37_id, "chat")}>
            <MessageSquare className="h-4 w-4" />
            Chat
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <OpenPortButtons
            agentId={agent.agent37_id}
            ports={agent.ports}
            disabled={!running}
            template={agent.template}
            size="sm"
          />
          {role === "admin" && onChanged && (
            <AgentOptionsMenu agent={agent} onChanged={onChanged} />
          )}
        </div>
      </div>
    </div>
  );
}
