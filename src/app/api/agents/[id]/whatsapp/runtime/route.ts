import { requireAgentAccess } from "@/lib/auth";
import { ApiError, handleError, json, readJson } from "@/lib/http";
import { getWhatsAppConnection } from "@/lib/whatsapp-connections";

import {
  provisionWhatsAppWorkflowForConnection,
  setWhatsAppWorkflowEnabledForConnection,
} from "@/lib/kapso-workflows";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db, row } = await requireAgentAccess(id, "admin");
    const body = await readJson<{ action?: "provision" | "enable" | "disable" }>(request);
    const connection = await getWhatsAppConnection(db, id);

    if (body.action === "provision") {
      if (connection.active_knowledge_version === null) {
        throw new ApiError(
          409,
          "knowledge_not_published",
          "Test and publish the approved knowledge draft before preparing the workflow"
        );
      }
      const snapshot = await db
        .from("agent_whatsapp_knowledge_versions")
        .select("compiled_prompt")
        .eq("agent37_id", id)
        .eq("workspace_id", row.workspace_id)
        .eq("version", connection.active_knowledge_version)
        .single();
      if (snapshot.error || !snapshot.data?.compiled_prompt) {
        throw new ApiError(409, "knowledge_snapshot_missing", "The published knowledge snapshot could not be loaded");
      }
      const provisioned = await provisionWhatsAppWorkflowForConnection(
        db,
        connection,
        snapshot.data.compiled_prompt
      );
      const sync = await db
        .from("agent_whatsapp_connections")
        .update({
          synced_knowledge_version: connection.active_knowledge_version,
          knowledge_last_synced_at: new Date().toISOString(),
          knowledge_last_error: null,
        })
        .eq("agent37_id", id)
        .eq("workspace_id", row.workspace_id)
        .eq("kapso_workflow_id", provisioned.kapso_workflow_id);
      if (sync.error) throw sync.error;
    } else if (body.action === "enable" || body.action === "disable") {
      if (
        body.action === "enable" &&
        (connection.active_knowledge_version === null ||
          connection.synced_knowledge_version !== connection.active_knowledge_version ||
          !connection.sandbox_tested_at)
      ) {
        throw new ApiError(
          409,
          "knowledge_not_synced",
          "Test, publish, and sync the current knowledge version before enabling the WhatsApp Agent"
        );
      }
      await setWhatsAppWorkflowEnabledForConnection(db, connection, body.action === "enable");
    } else {
      throw new ApiError(400, "invalid_action", "Choose provision, enable, or disable");
    }

    const saved = await getWhatsAppConnection(db, row.agent37_id);
    return json({
      provisioned: Boolean(saved.kapso_workflow_id && saved.kapso_trigger_id),
      workflowState: saved.workflow_status,
      triggerActive: saved.trigger_active,
      model: saved.provider_model_name ?? saved.provider_model_id,
      lastSyncedAt: saved.workflow_last_synced_at,
      lastError: saved.workflow_last_error,
      activeKnowledgeVersion: saved.active_knowledge_version,
      syncedKnowledgeVersion: saved.synced_knowledge_version,
    });
  } catch (error) {
    return handleError(error);
  }
}
