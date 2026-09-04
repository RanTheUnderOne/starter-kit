import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { bearerToken, hashMcpToken } from "@/lib/mcp-auth";
import { kapso } from "@/lib/kapso";
import type { DB } from "@/lib/auth";
import type { AgentWhatsAppConnection } from "@/lib/types";
import {
  addTextKnowledge,
  addUrlKnowledge,
  getKnowledgeState,
  publishKnowledge,
  removeKnowledgeSource,
  resyncKnowledgeSource,
  saveKnowledgeProfile,
} from "@/lib/whatsapp-knowledge-store";
import { compileKnowledgePrompt, type BusinessProfile } from "@/lib/whatsapp-knowledge";
import {
  handoffWhatsAppExecution,
  listActiveWhatsAppHandoffs,
  provisionWhatsAppWorkflowForConnection,
  resumeWhatsAppHandoff,
  setWhatsAppWorkflowEnabledForConnection,
} from "@/lib/kapso-workflows";
import { answerWhatsAppSandboxQuestion, buildWhatsAppDashboardStatus } from "@/lib/whatsapp-dashboard";

function text(value: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    ...(!isError && value && typeof value === "object" ? { structuredContent: value as Record<string, unknown> } : {}),
    ...(isError ? { isError: true } : {}),
  };
}

function redactSensitive(value: unknown, maxLength = 1_000) {
  return String(value ?? "")
    .replace(/\bBearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk_live_|alfi_mcp_)[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/\b(api[_-]?key|token|secret)(\s*[=:]\s*)[^\s,"']+/gi, "$1$2[REDACTED]")
    .slice(0, maxLength);
}

function toolError(error: unknown) {
  const message = redactSensitive(error instanceof Error ? error.message : "WhatsApp operation failed");
  return text({ error: "upstream_error", message }, true);
}

function requireConnected(connection: AgentWhatsAppConnection) {
  if (!connection.enabled || connection.status === "revoked") {
    throw new Error("WhatsApp access is revoked. Reconnect it in Alfi Settings.");
  }
  if (connection.status !== "connected" || !connection.phone_number_id) {
    throw new Error("WhatsApp is not connected. Connect it in Alfi Settings.");
  }
  return connection.phone_number_id;
}

function requireBusinessAccount(connection: AgentWhatsAppConnection) {
  requireConnected(connection);
  if (!connection.business_account_id) {
    throw new Error("WhatsApp templates are still synchronizing. Try again shortly.");
  }
  return connection.business_account_id;
}

function ensureScoped(value: unknown, phoneNumberId: string) {
  const envelope = value as {
    data?: { phone_number_id?: string; kapso?: { phone_number_id?: string } };
  };
  const found = envelope.data?.phone_number_id ?? envelope.data?.kapso?.phone_number_id;
  if (!found || found !== phoneNumberId) {
    throw new Error("Resource is outside this agent's WhatsApp account");
  }
  return value;
}

const outputSchema = {
  ok: z.boolean(),
  tool: z.string(),
  requestId: z.string().optional(),
  replayed: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()),
};

const requestSchema = { request_id: z.string().min(8).max(128) };
const ownerConfirmationSchema = {
  ...requestSchema,
  owner_confirmed: z.literal(true).describe("Explicit confirmation from the authenticated business owner"),
};

const profileSchema = {
  businessName: z.string().max(200).optional(),
  description: z.string().max(8_000).optional(),
  services: z.array(z.string().max(2_000)).max(100).optional(),
  hours: z.string().max(2_000).optional(),
  serviceAreas: z.array(z.string().max(2_000)).max(100).optional(),
  languages: z.array(z.string().max(100)).max(20).optional(),
  tone: z.string().max(500).optional(),
  approvedPricingFacts: z.array(z.string().max(2_000)).max(100).optional(),
  faqs: z.array(z.object({ question: z.string().max(1_000), answer: z.string().max(4_000) })).max(200).optional(),
  escalationPolicy: z.string().max(4_000).optional(),
  forbiddenClaims: z.array(z.string().max(2_000)).max(100).optional(),
  ownerNotificationTarget: z.string().max(500).optional(),
};

function result(tool: string, data: Record<string, unknown>, audit?: { requestId: string; replayed: boolean }) {
  return text({ ok: true, tool, ...(audit ? { requestId: audit.requestId, replayed: audit.replayed } : {}), data });
}

function publicConnection(connection: AgentWhatsAppConnection) {
  return {
    connectionStatus: connection.enabled ? connection.status : "revoked",
    displayNumber: connection.display_phone_number,
    connectedAt: connection.connected_at,
    provisioned: Boolean(connection.kapso_workflow_id && connection.kapso_trigger_id),
    workflowStatus: connection.workflow_status,
    triggerActive: connection.trigger_active,
    model: connection.provider_model_name ?? connection.provider_model_id,
    lastSyncedAt: connection.workflow_last_synced_at,
    lastError: redactSensitive(connection.workflow_last_error ?? connection.knowledge_last_error ?? connection.provisioning_error) || null,
    activeKnowledgeVersion: connection.active_knowledge_version,
    syncedKnowledgeVersion: connection.synced_knowledge_version,
  };
}

function publicSource(source: Record<string, unknown>) {
  return {
    id: source.id,
    kind: source.source_kind ?? source.kind,
    label: source.label,
    mediaType: source.media_type ?? source.mediaType,
    status: source.status,
    provenance: source.provenance,
    digest: source.content_digest ?? source.digest,
    lastError: redactSensitive(source.last_error ?? source.lastError) || null,
    lastSyncedAt: source.last_synced_at ?? source.lastSyncedAt,
    createdAt: source.created_at ?? source.createdAt,
  };
}

function publicExecution(execution: {
  id: string;
  status: string;
  tracking_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  whatsapp_conversation_id?: string | null;
  current_step?: { id?: string; name?: string; node_type?: string } | null;
  error_details?: Record<string, unknown> | null;
}) {
  const message = execution.error_details?.message;
  return {
    id: execution.id,
    status: execution.status,
    trackingId: execution.tracking_id ?? null,
    conversationId: execution.whatsapp_conversation_id ?? null,
    startedAt: execution.started_at ?? null,
    endedAt: execution.ended_at ?? null,
    currentStep: execution.current_step ?? null,
    error: typeof message === "string" ? redactSensitive(message, 500) : null,
  };
}

async function assertCurrentConnection(db: DB, connection: AgentWhatsAppConnection) {
  const current = await db
    .from("agent_whatsapp_connections")
    .select("*")
    .eq("workspace_id", connection.workspace_id)
    .eq("agent37_id", connection.agent37_id)
    .eq("token_hash", connection.token_hash)
    .maybeSingle();
  if (current.error) throw new Error("WhatsApp tenant scope could not be verified");
  if (!current.data) throw new Error("WhatsApp MCP credential is no longer valid");
  const scoped = current.data as AgentWhatsAppConnection;
  if (!scoped.enabled || scoped.status === "revoked") throw new Error("WhatsApp access is revoked");
  return scoped;
}

function sanitizedError(error: unknown) {
  return redactSensitive(error instanceof Error ? error.message : "WhatsApp operation failed");
}

async function runAuditedMutation(
  db: DB,
  connection: AgentWhatsAppConnection,
  toolName: string,
  requestId: string,
  operation: (current: AgentWhatsAppConnection) => Promise<Record<string, unknown>>
) {
  const current = await assertCurrentConnection(db, connection);
  const existing = await db
    .from("agent_whatsapp_mcp_audit")
    .select("status,result,error_message")
    .eq("agent37_id", current.agent37_id)
    .eq("tool_name", toolName)
    .eq("request_id", requestId)
    .maybeSingle();
  if (existing.error) throw new Error("WhatsApp audit history could not be read");
  if (existing.data?.status === "succeeded") {
    return { data: (existing.data.result ?? {}) as Record<string, unknown>, replayed: true };
  }
  if (existing.data?.status === "started") throw new Error("This request is already in progress");

  const started = existing.data
    ? await db
        .from("agent_whatsapp_mcp_audit")
        .update({ status: "started", result: null, error_message: null, updated_at: new Date().toISOString() })
        .eq("agent37_id", current.agent37_id)
        .eq("tool_name", toolName)
        .eq("request_id", requestId)
        .eq("status", "failed")
    : await db.from("agent_whatsapp_mcp_audit").insert({
        agent37_id: current.agent37_id,
        workspace_id: current.workspace_id,
        tool_name: toolName,
        request_id: requestId,
        status: "started",
      });
  if (started.error) {
    if (started.error.code === "23505") throw new Error("This request is already in progress");
    throw new Error("WhatsApp audit record could not be created");
  }

  try {
    const data = await operation(current);
    const saved = await db
      .from("agent_whatsapp_mcp_audit")
      .update({ status: "succeeded", result: data, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("agent37_id", current.agent37_id)
      .eq("workspace_id", current.workspace_id)
      .eq("tool_name", toolName)
      .eq("request_id", requestId)
      .eq("status", "started");
    if (saved.error) throw new Error("WhatsApp audit result could not be persisted");
    return { data, replayed: false };
  } catch (error) {
    await db
      .from("agent_whatsapp_mcp_audit")
      .update({ status: "failed", error_message: sanitizedError(error), completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("agent37_id", current.agent37_id)
      .eq("workspace_id", current.workspace_id)
      .eq("tool_name", toolName)
      .eq("request_id", requestId);
    throw error;
  }
}

function createServer(db: DB, connection: AgentWhatsAppConnection) {
  const server = new McpServer({ name: "alfi-whatsapp", version: "1.0.0" });
  const run = async (operation: () => Promise<unknown>) => {
    try {
      return text(await operation());
    } catch (error) {
      return toolError(error);
    }
  };
  const runStructured = async (operation: () => Promise<ReturnType<typeof text>>) => {
    try {
      return await operation();
    } catch (error) {
      return toolError(error);
    }
  };

  server.registerTool(
    "whatsapp_connection_status",
    { description: "Show whether this Alfi agent's WhatsApp Business number is connected." },
    async () =>
      text({
        status: connection.enabled ? connection.status : "revoked",
        display_phone_number: connection.display_phone_number,
        connected_at: connection.connected_at,
      })
  );

  const listSchema = {
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().optional(),
    before: z.string().optional(),
  };
  server.registerTool(
    "whatsapp_list_conversations",
    {
      description: "List conversations for this agent's assigned WhatsApp number.",
      inputSchema: {
        ...listSchema,
        status: z.enum(["active", "ended"]).optional(),
        phone_number: z.string().optional(),
      },
    },
    async (args) => run(() => kapso.listConversations(requireConnected(connection), args))
  );
  server.registerTool(
    "whatsapp_get_conversation",
    {
      description: "Get one WhatsApp conversation by its Kapso conversation ID.",
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) =>
      run(async () => {
        const phoneNumberId = requireConnected(connection);
        return ensureScoped(await kapso.getConversation(id, phoneNumberId), phoneNumberId);
      })
  );
  server.registerTool(
    "whatsapp_list_messages",
    {
      description: "List messages for this agent's assigned WhatsApp number.",
      inputSchema: {
        ...listSchema,
        conversation_id: z.string().optional(),
        phone_number: z.string().optional(),
        direction: z.enum(["inbound", "outbound"]).optional(),
        status: z.enum(["pending", "sent", "delivered", "read", "failed"]).optional(),
        since: z.string().optional(),
        until: z.string().optional(),
      },
    },
    async (args) => run(() => kapso.listMessages(requireConnected(connection), args))
  );
  server.registerTool(
    "whatsapp_get_message",
    {
      description: "Get one WhatsApp message by message ID.",
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) =>
      run(async () => {
        const phoneNumberId = requireConnected(connection);
        return ensureScoped(await kapso.getMessage(id, phoneNumberId), phoneNumberId);
      })
  );
  server.registerTool(
    "whatsapp_send_message",
    {
      description: "Send approved text to a WhatsApp phone number or business-scoped user ID.",
      inputSchema: {
        to: z.string().min(1).optional(),
        recipient: z.string().min(1).optional(),
        text: z.string().min(1).max(4096),
      },
    },
    async ({ to, recipient, text: body }) =>
      run(() => {
        if (!to && !recipient) throw new Error("to or recipient is required");
        return kapso.send(requireConnected(connection), {
          ...(to ? { to } : { recipient }),
          type: "text",
          text: { body },
        });
      })
  );
  server.registerTool(
    "whatsapp_mark_read",
    {
      description: "Mark one inbound WhatsApp message as read.",
      inputSchema: { message_id: z.string().min(1) },
    },
    async ({ message_id }) =>
      run(() => kapso.markRead(requireConnected(connection), message_id))
  );
  server.registerTool(
    "whatsapp_react",
    {
      description: "React to an approved WhatsApp message with one emoji.",
      inputSchema: {
        to: z.string().min(1),
        message_id: z.string().min(1),
        emoji: z.string().min(1).max(16),
      },
    },
    async ({ to, message_id, emoji }) =>
      run(() =>
        kapso.send(requireConnected(connection), {
          to,
          type: "reaction",
          reaction: { message_id, emoji },
        })
      )
  );
  server.registerTool(
    "whatsapp_list_templates",
    {
      description: "List templates available to this WhatsApp Business number.",
      inputSchema: listSchema,
    },
    async (args) => run(() => kapso.listTemplates(requireBusinessAccount(connection), args))
  );
  server.registerTool(
    "whatsapp_send_template",
    {
      description: "Send one approved WhatsApp template.",
      inputSchema: {
        to: z.string().min(1).optional(),
        recipient: z.string().min(1).optional(),
        name: z.string().min(1),
        language_code: z.string().min(2),
        components: z.array(z.record(z.string(), z.unknown())).optional(),
      },
    },
    async ({ to, recipient, name, language_code, components }) =>
      run(() => {
        if (!to && !recipient) throw new Error("to or recipient is required");
        return kapso.send(requireConnected(connection), {
          ...(to ? { to } : { recipient }),
          type: "template",
          template: {
            name,
            language: { code: language_code },
            ...(components ? { components } : {}),
          },
        });
      })
  );

  server.registerTool(
    "get_whatsapp_agent_status",
    {
      description: "Get the tenant-bound WhatsApp Agent runtime, knowledge, run, and handoff status without secrets.",
      outputSchema: outputSchema,
    },
    async () => runStructured(async () => {
      const current = await assertCurrentConnection(db, connection);
      const [executions, handoffs] = current.kapso_workflow_id
        ? await Promise.all([
            kapso.listWorkflowExecutions(current.kapso_workflow_id, { limit: 20 }),
            db.from("agent_whatsapp_handoffs").select("workflow_execution_id,whatsapp_conversation_id,reason,occurred_at").eq("workspace_id", current.workspace_id).eq("agent37_id", current.agent37_id).eq("status", "handoff").order("occurred_at", { ascending: false }).limit(50),
          ])
        : [[], { data: [], error: null }];
      if (handoffs.error) throw new Error("Active handoffs could not be loaded");
      return result("get_whatsapp_agent_status", {
        ...publicConnection(current),
        ...buildWhatsAppDashboardStatus(current, executions, handoffs.data ?? []),
      });
    })
  );

  server.registerTool(
    "provision_whatsapp_agent",
    {
      description: "Idempotently provision or reconcile this credential's connected WhatsApp Agent, initially disabled.",
      inputSchema: { ...requestSchema, provider_model_id: z.string().min(1).max(200).optional() },
      outputSchema: outputSchema,
    },
    async ({ request_id, provider_model_id }) => runStructured(async () => {
      const audited = await runAuditedMutation(db, connection, "provision_whatsapp_agent", request_id, async (current) => {
        requireConnected(current);
        const knowledge = await getKnowledgeState(db, current.agent37_id);
        const instructions = compileKnowledgePrompt({ version: knowledge.activeVersion ?? 1, profile: knowledge.profile, sources: knowledge.readySources });
        const saved = await provisionWhatsAppWorkflowForConnection(db, current, instructions, provider_model_id);
        const published = await publishKnowledge(db, current.agent37_id, current.workspace_id);
        const readBack = await assertCurrentConnection(db, saved);
        return { ...publicConnection(readBack), publishedVersion: published.version, knowledgeSynced: published.synced };
      });
      return result("provision_whatsapp_agent", audited.data, { requestId: request_id, replayed: audited.replayed });
    })
  );

  server.registerTool(
    "get_whatsapp_agent_profile",
    {
      description: "Get the approved business profile used to ground this tenant's WhatsApp Agent.",
      outputSchema: outputSchema,
    },
    async () => runStructured(async () => {
      const current = await assertCurrentConnection(db, connection);
      const knowledge = await getKnowledgeState(db, current.agent37_id);
      return result("get_whatsapp_agent_profile", { profile: knowledge.profile });
    })
  );

  server.registerTool(
    "update_whatsapp_agent_profile",
    {
      description: "Replace the tenant-bound approved business profile, publish it, and verify any Kapso sync.",
      inputSchema: { ...requestSchema, ...profileSchema },
      outputSchema: outputSchema,
    },
    async ({ request_id, ...profile }) => runStructured(async () => {
      const audited = await runAuditedMutation(db, connection, "update_whatsapp_agent_profile", request_id, async (current) => {
        await saveKnowledgeProfile(db, current.agent37_id, current.workspace_id, profile as Partial<BusinessProfile>);
        const published = await publishKnowledge(db, current.agent37_id, current.workspace_id);
        const readBack = await getKnowledgeState(db, current.agent37_id);
        return { profile: readBack.profile, publishedVersion: published.version, knowledgeSynced: published.synced };
      });
      return result("update_whatsapp_agent_profile", audited.data, { requestId: request_id, replayed: audited.replayed });
    })
  );

  server.registerTool(
    "list_knowledge_sources",
    {
      description: "List tenant-bound source metadata and sync state; extracted source contents are not returned.",
      outputSchema: outputSchema,
    },
    async () => runStructured(async () => {
      const current = await assertCurrentConnection(db, connection);
      const knowledge = await getKnowledgeState(db, current.agent37_id);
      return result("list_knowledge_sources", {
        sources: knowledge.sources.map((source) => publicSource(source as unknown as Record<string, unknown>)),
        activeVersion: knowledge.activeVersion,
        syncedVersion: knowledge.syncedVersion,
      });
    })
  );

  server.registerTool(
    "add_knowledge_source",
    {
      description: "Idempotently add approved pasted text or an HTTPS website to this tenant's knowledge store.",
      inputSchema: { ...requestSchema, kind: z.enum(["text", "url"]), label: z.string().max(300).optional(), text: z.string().max(120_000).optional(), url: z.string().url().max(2_000).optional() },
      outputSchema: outputSchema,
    },
    async ({ request_id, kind, label, text: sourceText, url }) => runStructured(async () => {
      const audited = await runAuditedMutation(db, connection, "add_knowledge_source", request_id, async (current) => {
        if (kind === "text" && !sourceText) throw new Error("text is required for a text source");
        if (kind === "url" && !url) throw new Error("url is required for a URL source");
        const source = kind === "text"
          ? await addTextKnowledge(db, current.agent37_id, current.workspace_id, label ?? "Pasted text", sourceText!)
          : await addUrlKnowledge(db, current.agent37_id, current.workspace_id, url!);
        const published = await publishKnowledge(db, current.agent37_id, current.workspace_id);
        return { source: publicSource(source as unknown as Record<string, unknown>), publishedVersion: published.version, knowledgeSynced: published.synced };
      });
      return result("add_knowledge_source", audited.data, { requestId: request_id, replayed: audited.replayed });
    })
  );

  server.registerTool(
    "remove_knowledge_source",
    {
      description: "Soft-delete one tenant-bound knowledge source after explicit owner confirmation.",
      inputSchema: { ...ownerConfirmationSchema, source_id: z.string().uuid() },
      outputSchema: outputSchema,
    },
    async ({ request_id, source_id }) => runStructured(async () => {
      const audited = await runAuditedMutation(db, connection, "remove_knowledge_source", request_id, async (current) => {
        await removeKnowledgeSource(db, current.agent37_id, source_id);
        const published = await publishKnowledge(db, current.agent37_id, current.workspace_id);
        return { sourceId: source_id, removed: true, publishedVersion: published.version, knowledgeSynced: published.synced };
      });
      return result("remove_knowledge_source", audited.data, { requestId: request_id, replayed: audited.replayed });
    })
  );

  server.registerTool(
    "resync_knowledge_source",
    {
      description: "Idempotently refresh one tenant-bound source without changing its identity.",
      inputSchema: { ...requestSchema, source_id: z.string().uuid() },
      outputSchema: outputSchema,
    },
    async ({ request_id, source_id }) => runStructured(async () => {
      const audited = await runAuditedMutation(db, connection, "resync_knowledge_source", request_id, async (current) => {
        const source = await resyncKnowledgeSource(db, current.agent37_id, current.workspace_id, source_id);
        const published = await publishKnowledge(db, current.agent37_id, current.workspace_id);
        return { source: publicSource(source as unknown as Record<string, unknown>), publishedVersion: published.version, knowledgeSynced: published.synced };
      });
      return result("resync_knowledge_source", audited.data, { requestId: request_id, replayed: audited.replayed });
    })
  );

  server.registerTool(
    "test_whatsapp_agent",
    {
      description: "Run a non-sending grounded sandbox answer after explicit owner confirmation.",
      inputSchema: { ...ownerConfirmationSchema, question: z.string().min(1).max(4_000) },
      outputSchema: outputSchema,
    },
    async ({ request_id, question }) => runStructured(async () => {
      const audited = await runAuditedMutation(db, connection, "test_whatsapp_agent", request_id, async (current) => {
        const knowledge = await getKnowledgeState(db, current.agent37_id);
        const answer = answerWhatsAppSandboxQuestion(question, { profile: knowledge.profile, sources: knowledge.readySources });
        const testedAt = new Date().toISOString();
        const updated = await db
          .from("agent_whatsapp_connections")
          .update({ sandbox_tested_at: testedAt, updated_at: testedAt })
          .eq("agent37_id", current.agent37_id)
          .eq("workspace_id", current.workspace_id);
        if (updated.error) throw updated.error;
        return { ...answer, testedAt };
      });
      return result("test_whatsapp_agent", audited.data, { requestId: request_id, replayed: audited.replayed });
    })
  );

  server.registerTool(
    "enable_whatsapp_agent",
    {
      description: "Enable the inbound trigger only after the business owner explicitly confirms activation.",
      inputSchema: { ...ownerConfirmationSchema },
      outputSchema: outputSchema,
    },
    async ({ request_id }) => runStructured(async () => {
      const audited = await runAuditedMutation(db, connection, "enable_whatsapp_agent", request_id, async (current) => {
        const knowledge = await getKnowledgeState(db, current.agent37_id);
        if (!knowledge.profile.businessName || !knowledge.profile.description || knowledge.readySources.length === 0) {
          throw new Error("Complete the business profile and add approved knowledge before enabling the agent");
        }
        if (knowledge.activeVersion === null || knowledge.syncedVersion !== knowledge.activeVersion) {
          throw new Error("Publish and sync the latest approved knowledge before enabling the agent");
        }
        if (!current.sandbox_tested_at) {
          throw new Error("Run and approve a sandbox test before enabling the agent");
        }
        const saved = await setWhatsAppWorkflowEnabledForConnection(db, current, true);
        return publicConnection(saved);
      });
      return result("enable_whatsapp_agent", audited.data, { requestId: request_id, replayed: audited.replayed });
    })
  );

  server.registerTool(
    "disable_whatsapp_agent",
    {
      description: "Disable the inbound trigger without deleting the workflow, after explicit owner confirmation.",
      inputSchema: { ...ownerConfirmationSchema },
      outputSchema: outputSchema,
    },
    async ({ request_id }) => runStructured(async () => {
      const audited = await runAuditedMutation(db, connection, "disable_whatsapp_agent", request_id, async (current) => {
        const saved = await setWhatsAppWorkflowEnabledForConnection(db, current, false);
        return publicConnection(saved);
      });
      return result("disable_whatsapp_agent", audited.data, { requestId: request_id, replayed: audited.replayed });
    })
  );

  server.registerTool(
    "list_active_handoffs",
    {
      description: "List active handoffs in this tenant's provisioned WhatsApp workflow.",
      outputSchema: outputSchema,
    },
    async () => runStructured(async () => {
      const current = await assertCurrentConnection(db, connection);
      if (!current.kapso_workflow_id) throw new Error("WhatsApp workflow has not been provisioned");
      const executions = await listActiveWhatsAppHandoffs(current.kapso_workflow_id);
      return result("list_active_handoffs", { handoffs: executions.map(publicExecution) });
    })
  );

  server.registerTool(
    "handoff_conversation",
    {
      description: "Stop automation for one scoped workflow execution after explicit owner confirmation.",
      inputSchema: { ...ownerConfirmationSchema, execution_id: z.string().min(1).max(200), reason: z.string().max(1_000).optional() },
      outputSchema: outputSchema,
    },
    async ({ request_id, execution_id, reason }) => runStructured(async () => {
      const audited = await runAuditedMutation(db, connection, "handoff_conversation", request_id, async (current) => {
        if (!current.kapso_workflow_id) throw new Error("WhatsApp workflow has not been provisioned");
        const execution = await handoffWhatsAppExecution(current.kapso_workflow_id, execution_id);
        const saved = await db.from("agent_whatsapp_handoffs").upsert({
          workflow_execution_id: execution.id,
          agent37_id: current.agent37_id,
          workspace_id: current.workspace_id,
          kapso_workflow_id: current.kapso_workflow_id,
          whatsapp_conversation_id: execution.whatsapp_conversation_id ?? null,
          reason: reason ?? "Owner requested human takeover",
          source: "mcp",
          status: "handoff",
          occurred_at: new Date().toISOString(),
          resumed_at: null,
          updated_at: new Date().toISOString(),
        });
        if (saved.error) throw new Error("Handoff audit state could not be persisted");
        return { execution: publicExecution(execution) };
      });
      return result("handoff_conversation", audited.data, { requestId: request_id, replayed: audited.replayed });
    })
  );

  server.registerTool(
    "resume_conversation",
    {
      description: "Return one scoped handoff to the waiting agent after explicit owner confirmation.",
      inputSchema: { ...ownerConfirmationSchema, execution_id: z.string().min(1).max(200) },
      outputSchema: outputSchema,
    },
    async ({ request_id, execution_id }) => runStructured(async () => {
      const audited = await runAuditedMutation(db, connection, "resume_conversation", request_id, async (current) => {
        if (!current.kapso_workflow_id) throw new Error("WhatsApp workflow has not been provisioned");
        const execution = await resumeWhatsAppHandoff(current.kapso_workflow_id, execution_id);
        const saved = await db.from("agent_whatsapp_handoffs").update({ status: "resumed", resumed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("workspace_id", current.workspace_id).eq("agent37_id", current.agent37_id).eq("kapso_workflow_id", current.kapso_workflow_id).eq("workflow_execution_id", execution_id);
        if (saved.error) throw new Error("Handoff resume state could not be persisted");
        return { execution: publicExecution(execution) };
      });
      return result("resume_conversation", audited.data, { requestId: request_id, replayed: audited.replayed });
    })
  );

  server.registerTool(
    "inspect_workflow_runs",
    {
      description: "Inspect sanitized recent run statuses and errors for this tenant's WhatsApp workflow.",
      inputSchema: { limit: z.number().int().min(1).max(100).optional(), status: z.enum(["running", "waiting", "ended", "failed", "handoff"]).optional() },
      outputSchema: outputSchema,
    },
    async ({ limit, status }) => runStructured(async () => {
      const current = await assertCurrentConnection(db, connection);
      if (!current.kapso_workflow_id) throw new Error("WhatsApp workflow has not been provisioned");
      const executions = await kapso.listWorkflowExecutions(current.kapso_workflow_id, { limit: limit ?? 20, ...(status ? { status } : {}) });
      return result("inspect_workflow_runs", { runs: executions.map(publicExecution) });
    })
  );
  return server;
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return new Response("Unauthorized", { status: 401 });
  const db = createAdminClient();
  const { data } = await db
    .from("agent_whatsapp_connections")
    .select("*")
    .eq("token_hash", hashMcpToken(token))
    .maybeSingle();
  if (!data) return new Response("Unauthorized", { status: 401 });

  const server = createServer(db, data as AgentWhatsAppConnection);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
