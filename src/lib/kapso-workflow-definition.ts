export const WHATSAPP_AGENT_TOOLS = [
  "get_whatsapp_context",
  "contact_conversations",
  "save_variable",
  "get_variable",
  "send_notification_to_user",
  "enter_waiting",
  "handoff_to_human",
  "complete_task",
] as const;

export interface WhatsAppAgentDefinitionOptions {
  providerModelId: string;
  businessInstructions: string;
  maxIterations?: number;
  maxTokens?: number;
}

export interface WorkflowDefinition {
  nodes: Array<{
    id: string;
    type: "flow-node";
    position: { x: number; y: number };
    data: {
      node_type: "start" | "agent";
      config: Record<string, unknown>;
      display_name: string;
    };
  }>;
  edges: Array<{
    source: string;
    target: string;
    label: "next";
    type: "default";
  }>;
}

const SAFETY_PROMPT = `You are the business's WhatsApp customer-response agent.

Operate only from the approved business instructions below and the current WhatsApp conversation. Never invent business facts, pricing, availability, policies, or commitments. Ask one concise clarification when approved information is insufficient. If uncertainty remains, a person is requested, the topic is a complaint, legal, refund, sensitive, custom pricing, discount, high-value lead, repeated misunderstanding, or a tool fails, call handoff_to_human with a useful reason and summary. Do not send further automated messages after handoff.

You may answer questions and collect a lead's name, need, urgency, and preferred callback time. You must not accept payment, negotiate, make binding commitments, or create/update CRM records. Save useful lead details with save_variable. Use get_whatsapp_context and contact_conversations only when context is needed.

For every question that requires another customer reply, send the question with send_notification_to_user and then call enter_waiting. New inbound messages are injected into this same execution, so continue from retained context. Call complete_task only when the customer request is fully resolved and no reply is expected.

WhatsApp compliance is mandatory: free-form messages may only answer the latest customer message while its 24-hour customer-service window is open. Each inbound user message opens or resets that window. Never initiate an out-of-window free-form message. Because no template-sending tool is enabled, hand off rather than attempting an out-of-window outbound message.

Approved business instructions:
`;

export function buildWhatsAppAgentDefinition({
  providerModelId,
  businessInstructions,
  maxIterations = 12,
  maxTokens = 1200,
}: WhatsAppAgentDefinitionOptions): WorkflowDefinition {
  const modelId = providerModelId.trim();
  if (!modelId) throw new Error("A Kapso provider model ID is required");
  const instructions = businessInstructions.trim();
  if (!instructions) throw new Error("Approved business instructions are required");
  if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 20) {
    throw new Error("maxIterations must be an integer from 1 to 20");
  }
  if (!Number.isInteger(maxTokens) || maxTokens < 256 || maxTokens > 2048) {
    throw new Error("maxTokens must be an integer from 256 to 2048");
  }

  return {
    nodes: [
      {
        id: "start",
        type: "flow-node",
        position: { x: 100, y: 160 },
        data: { node_type: "start", config: {}, display_name: "Start" },
      },
      {
        id: "customer_agent",
        type: "flow-node",
        position: { x: 420, y: 160 },
        data: {
          node_type: "agent",
          display_name: "WhatsApp Customer Agent",
          config: {
            system_prompt: `${SAFETY_PROMPT}${instructions}`,
            provider_model_id: modelId,
            temperature: 0.1,
            max_iterations: maxIterations,
            max_tokens: maxTokens,
            prompt_cache_ttl: "5m",
            message_delivery_mode: "tool_only",
            enabled_default_tools: [...WHATSAPP_AGENT_TOOLS],
            sandbox_enabled: false,
          },
        },
      },
    ],
    edges: [
      {
        source: "start",
        target: "customer_agent",
        label: "next",
        type: "default",
      },
    ],
  };
}

export function isWithinWhatsAppServiceWindow(lastInboundAt: string | Date, now = new Date()) {
  const inbound = lastInboundAt instanceof Date ? lastInboundAt : new Date(lastInboundAt);
  const elapsed = now.getTime() - inbound.getTime();
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000;
}
