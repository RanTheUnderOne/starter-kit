import { notFound } from "next/navigation";
import { getAgentRow, requireMember, requireUser } from "@/lib/auth";
import { parseAgentTab } from "@/lib/dashboard-tabs";
import { AgentWorkspace } from "@/components/AgentWorkspace";
import { isStaffUser } from "@/lib/staff";

// The per-agent workspace. The active agent is bound to the URL; the optional catch-all carries
// the tab (/dashboard/agents/{agentId}/{tab}, default "chat"). This route lives OUTSIDE the
// (fleet) route group, so it renders its own full-height shell instead of the fleet sidebar.
export default async function AgentWorkspacePage({
  params,
}: {
  params: Promise<{ agentId: string; tab?: string[] }>;
}) {
  const { agentId, tab } = await params;

  const { db, user } = await requireUser();
  // One grammar, shared with the client SPA. The staff-only route is rejected server-side.
  const initialTab = parseAgentTab(tab, isStaffUser(user));
  if (initialTab === null) notFound();

  // The Supabase mirror is the source of truth for which app-workspace owns an agent. A missing
  // row, or a viewer who isn't a member of its workspace, is a 404 (we don't leak existence).
  const row = await getAgentRow(db, agentId).catch(() => null);
  if (!row) notFound();
  const role = await requireMember(db, row.workspace_id, user.id).catch(() => null);
  if (!role) notFound();

  return (
    <AgentWorkspace
      agentId={agentId}
      workspaceId={row.workspace_id}
      role={role}
      initialTab={initialTab}
    />
  );
}
