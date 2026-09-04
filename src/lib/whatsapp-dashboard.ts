import type { KapsoWorkflowExecution } from "@/lib/kapso";
import type { AgentWhatsAppConnection, WhatsAppAgentRuntimeStatus } from "@/lib/types";
import type { BusinessProfile, KnowledgeSource } from "@/lib/whatsapp-knowledge";

interface HandoffRow {
  workflow_execution_id: string;
  whatsapp_conversation_id: string | null;
  reason: string | null;
  occurred_at: string;
}

export function whatsappDraftReadiness(input: {
  connected: boolean;
  provisioned: boolean;
  businessName: string;
  description: string;
  readySourceCount: number;
  tested: boolean;
}) {
  const missing: string[] = [];
  if (!input.connected) missing.push("connection");
  if (!input.businessName.trim() || !input.description.trim()) missing.push("profile");
  if (input.readySourceCount < 1) missing.push("knowledge");
  if (!input.tested) missing.push("sandbox");
  if (!input.provisioned) missing.push("workflow");
  return { ready: missing.length === 0, missing };
}

function words(value: string) {
  return new Set(value.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
}

function overlap(question: Set<string>, candidate: string) {
  const candidateWords = words(candidate);
  let score = 0;
  for (const word of question) if (candidateWords.has(word)) score += 1;
  return score;
}

export function answerWhatsAppSandboxQuestion(
  question: string,
  knowledge: { profile: BusinessProfile; sources: KnowledgeSource[] }
) {
  if (/\b(?:refund|legal|lawyer|complaint|discount|custom pricing|human|person|representative)\b/i.test(question)) {
    return {
      answer: "This request requires a person. I would stop automation and hand off the conversation with its context.",
      grounded: false as const,
      citation: null,
    };
  }
  const query = words(question);
  const faq = knowledge.profile.faqs
    .map((item) => ({ item, score: overlap(query, item.question) }))
    .sort((a, b) => b.score - a.score)[0];
  const minimumScore = Math.min(2, query.size);
  if (minimumScore > 0 && faq?.score >= minimumScore) {
    return {
      answer: faq.item.answer,
      grounded: true as const,
      citation: `FAQ: ${faq.item.question}`,
    };
  }

  const sourceMatch = knowledge.sources
    .flatMap((source) =>
      source.text
        .split(/(?<=[.!?])\s+|\n+/)
        .filter(Boolean)
        .map((text) => ({ text: text.trim(), source, score: overlap(query, text) }))
    )
    .sort((a, b) => b.score - a.score)[0];
  if (minimumScore > 0 && sourceMatch?.score >= minimumScore) {
    return {
      answer: sourceMatch.text.slice(0, 800),
      grounded: true as const,
      citation: sourceMatch.source.label,
    };
  }
  return {
    answer: "I could not find an approved answer. I would ask one clarification, then hand this conversation to a person.",
    grounded: false as const,
    citation: null,
  };
}

function executionError(execution: KapsoWorkflowExecution | undefined) {
  const details = execution?.error_details;
  if (!details || typeof details !== "object") return null;
  const message = details.message;
  return typeof message === "string" && message.trim() ? message.slice(0, 500) : null;
}

export function buildWhatsAppDashboardStatus(
  connection: AgentWhatsAppConnection,
  executions: KapsoWorkflowExecution[] = [],
  handoffs: HandoffRow[] = []
): WhatsAppAgentRuntimeStatus {
  const latest = executions[0];
  return {
    runtime: {
      provisioned: Boolean(connection.kapso_workflow_id && connection.kapso_trigger_id),
      workflowState: connection.workflow_status,
      triggerActive: connection.trigger_active,
      model: connection.provider_model_name ?? connection.provider_model_id,
      lastRunStatus: latest?.status ?? null,
      lastSyncedAt: connection.workflow_last_synced_at,
      lastError:
        executionError(latest) ?? connection.workflow_last_error ?? connection.knowledge_last_error ?? connection.provisioning_error,
      activeKnowledgeVersion: connection.active_knowledge_version,
      syncedKnowledgeVersion: connection.synced_knowledge_version,
      sandboxTestedAt: connection.sandbox_tested_at ?? null,
    },
    conversations: executions
      .filter((execution) => ["running", "waiting", "handoff"].includes(execution.status))
      .map((execution) => ({
        executionId: execution.id,
        conversationId: execution.whatsapp_conversation_id ?? null,
        status: execution.status as "running" | "waiting" | "handoff",
      })),
    handoffs: handoffs.map((handoff) => ({
      executionId: handoff.workflow_execution_id,
      conversationId: handoff.whatsapp_conversation_id,
      reason: handoff.reason,
      occurredAt: handoff.occurred_at,
    })),
  };
}
