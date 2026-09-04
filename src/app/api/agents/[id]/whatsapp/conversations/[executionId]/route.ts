import { requireAgentAccess } from "@/lib/auth";
import { ApiError, handleError, json, readJson } from "@/lib/http";
import { getWhatsAppConnection } from "@/lib/whatsapp-connections";
import { handoffWhatsAppExecution, resumeWhatsAppHandoff } from "@/lib/kapso-workflows";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; executionId: string }> }
) {
  try {
    const { id, executionId } = await params;
    const { db, row } = await requireAgentAccess(id, "admin");
    const body = await readJson<{ action?: "handoff" | "resume" }>(request);
    const connection = await getWhatsAppConnection(db, id);
    if (!connection.kapso_workflow_id) {
      throw new ApiError(409, "workflow_not_ready", "WhatsApp workflow has not been provisioned");
    }

    const execution =
      body.action === "handoff"
        ? await handoffWhatsAppExecution(connection.kapso_workflow_id, executionId)
        : body.action === "resume"
          ? await resumeWhatsAppHandoff(connection.kapso_workflow_id, executionId)
          : null;
    if (!execution) throw new ApiError(400, "invalid_action", "Choose handoff or resume");

    const now = new Date().toISOString();
    if (body.action === "handoff") {
      const result = await db.from("agent_whatsapp_handoffs").upsert({
        workflow_execution_id: executionId,
        agent37_id: id,
        workspace_id: row.workspace_id,
        kapso_workflow_id: connection.kapso_workflow_id,
        whatsapp_conversation_id: execution.whatsapp_conversation_id ?? null,
        reason: "Owner started human takeover",
        source: "dashboard",
        status: "handoff",
        occurred_at: now,
        resumed_at: null,
        updated_at: now,
      });
      if (result.error) throw result.error;
    } else {
      const result = await db
        .from("agent_whatsapp_handoffs")
        .update({ status: "resumed", resumed_at: now, updated_at: now })
        .eq("agent37_id", id)
        .eq("workspace_id", row.workspace_id)
        .eq("workflow_execution_id", executionId);
      if (result.error) throw result.error;
    }

    return json({
      executionId: execution.id,
      conversationId: execution.whatsapp_conversation_id ?? null,
      status: execution.status,
    });
  } catch (error) {
    return handleError(error);
  }
}
