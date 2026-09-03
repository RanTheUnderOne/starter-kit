import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { bearerToken, hashMcpToken } from "@/lib/mcp-auth";
import { kapso } from "@/lib/kapso";
import type { AgentWhatsAppConnection } from "@/lib/types";

function text(value: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    ...(isError ? { isError: true } : {}),
  };
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : "WhatsApp operation failed";
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

function createServer(connection: AgentWhatsAppConnection) {
  const server = new McpServer({ name: "alfi-whatsapp", version: "1.0.0" });
  const run = async (operation: () => Promise<unknown>) => {
    try {
      return text(await operation());
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

  const server = createServer(data as AgentWhatsAppConnection);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
