"use client";

import { useState } from "react";
import { MoreHorizontal, RotateCw, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { isTransitional } from "@/lib/format";
import type { MergedAgent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAsyncAction } from "@/components/useAsyncAction";

export function AgentOptionsMenu({
  agent,
  onChanged,
}: {
  agent: MergedAgent;
  onChanged: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { busy, run } = useAsyncAction();
  const running = agent.live_status === "running";
  const transitional = isTransitional(agent.live_status);
  const name = agent.name?.trim() || "this agent";

  function action(path: "restart" | "stop", message: string) {
    run(async () => {
      await apiFetch(`/api/agents/${agent.agent37_id}/${path}`, { method: "POST" });
      toast.success(message);
      onChanged();
    });
  }

  async function deleteAgent() {
    await apiFetch(`/api/agents/${agent.agent37_id}`, { method: "DELETE" });
    toast.success("Agent deleted");
    onChanged();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" aria-label="Agent options">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={!running || busy} onClick={() => action("restart", "Restarting")}>
            <RotateCw className="h-4 w-4" />
            Restart agent
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!running || transitional || busy} onClick={() => action("stop", "Stopping")}>
            <Square className="h-4 w-4" />
            Stop agent
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={busy} onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />
            Delete agent
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${name}?`}
        description="This stops the agent and removes all its persistent storage. This cannot be undone."
        confirmText="Delete agent"
        destructive
        onConfirm={deleteAgent}
      />
    </>
  );
}
