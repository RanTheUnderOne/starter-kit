import { requireAgentAccess } from "@/lib/auth";
import { handleError, json } from "@/lib/http";
import { whatsappCloudConfig } from "@/lib/alfi-config";
import { getWhatsAppConnection } from "@/lib/whatsapp-connections";
import { customerWhatsAppStatus } from "@/lib/whatsapp-public-status";
import { kapso } from "@/lib/kapso";
import { buildWhatsAppDashboardStatus } from "@/lib/whatsapp-dashboard";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db } = await requireAgentAccess(id);
    const connection = await getWhatsAppConnection(db, id);
    const [executions, handoffResult] = await Promise.all([
      connection.kapso_workflow_id
        ? kapso.listWorkflowExecutions(connection.kapso_workflow_id, { limit: 20 }).catch(() => [])
        : Promise.resolve([]),
      db
        .from("agent_whatsapp_handoffs")
        .select("workflow_execution_id,whatsapp_conversation_id,reason,occurred_at")
        .eq("agent37_id", id)
        .eq("status", "handoff")
        .order("occurred_at", { ascending: false })
        .limit(50),
    ]);
    if (handoffResult.error) throw handoffResult.error;
    return json({
      ...customerWhatsAppStatus(connection, { cloudConfigured: Boolean(whatsappCloudConfig()) }),
      ...buildWhatsAppDashboardStatus(connection, executions, handoffResult.data ?? []),
    });
  } catch (error) {
    return handleError(error);
  }
}
