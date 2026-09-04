import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import type { AgentWhatsAppConnection } from "../src/lib/types";
import {
  answerWhatsAppSandboxQuestion,
  buildWhatsAppDashboardStatus,
  whatsappDraftReadiness,
} from "../src/lib/whatsapp-dashboard";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

function connectionFixture(overrides: Partial<AgentWhatsAppConnection> = {}): AgentWhatsAppConnection {
  return {
    agent37_id: "agent-a",
    workspace_id: "ws-1",
    token_hash: "secret-hash",
    enabled: true,
    status: "connected",
    provisioning_status: "ready",
    provisioning_error: null,
    kapso_customer_id: "cus_123",
    kapso_setup_link_id: "setup_123",
    phone_number_id: "123456",
    business_account_id: "waba_123",
    display_phone_number: "+972 50-123-4567",
    kapso_workflow_id: "wf_123",
    kapso_trigger_id: "tr_123",
    workflow_status: "active",
    trigger_active: true,
    provider_model_id: "model_123",
    provider_model_name: "GPT-4.1 mini",
    workflow_provisioned_at: "2026-01-01T00:00:00.000Z",
    workflow_last_synced_at: "2026-01-02T00:00:00.000Z",
    workflow_last_error: null,
    active_knowledge_version: 3,
    synced_knowledge_version: 3,
    knowledge_last_synced_at: "2026-01-02T00:00:00.000Z",
    knowledge_last_error: null,
    owner_phone_e164: null,
    webhook_url: "https://wa-agent-a.agent37.app/whatsapp/webhook",
    setup_expires_at: null,
    connected_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("WhatsApp Agent dashboard status", () => {
  test("summarizes runtime health and active handoffs without leaking execution context", () => {
    const status = buildWhatsAppDashboardStatus(
      connectionFixture(),
      [
        {
          id: "exec_waiting",
          status: "waiting",
          whatsapp_conversation_id: "conv_waiting",
          workflow: { id: "wf_123" },
        },
        {
          id: "exec_failed",
          status: "failed",
          whatsapp_conversation_id: "conv_1",
          workflow: { id: "wf_123" },
          execution_context: { customer_phone: "+972501234567" },
          error_details: { message: "Provider timed out" },
        },
      ],
      [
        {
          workflow_execution_id: "exec_handoff",
          whatsapp_conversation_id: "conv_2",
          reason: "Customer asked for a person",
          occurred_at: "2026-01-03T00:00:00.000Z",
        },
      ]
    );

    expect(status.runtime).toEqual(
      expect.objectContaining({
        provisioned: true,
        triggerActive: true,
        model: "GPT-4.1 mini",
        lastRunStatus: "waiting",
        lastError: null,
      })
    );
    expect(status.conversations).toEqual([
      expect.objectContaining({ executionId: "exec_waiting", status: "waiting" }),
    ]);
    expect(status.handoffs).toEqual([
      expect.objectContaining({ executionId: "exec_handoff", conversationId: "conv_2" }),
    ]);
    expect(JSON.stringify(status)).not.toContain("customer_phone");
  });

  test("requires a connected number, business identity, knowledge, and a sandbox test before enablement", () => {
    expect(
      whatsappDraftReadiness({
        connected: true,
        provisioned: true,
        businessName: "Alfi Dental",
        description: "Dental care in Tel Aviv",
        readySourceCount: 1,
        tested: true,
      })
    ).toEqual({ ready: true, missing: [] });

    expect(
      whatsappDraftReadiness({
        connected: false,
        provisioned: false,
        businessName: "",
        description: "",
        readySourceCount: 0,
        tested: false,
      }).missing
    ).toEqual(["connection", "profile", "knowledge", "sandbox", "workflow"]);
  });

  test("answers sandbox questions only from approved FAQ and falls back to handoff", () => {
    const approved = answerWhatsAppSandboxQuestion("When are you open?", {
      profile: {
        businessName: "Alfi Dental",
        description: "Dental care",
        services: [],
        hours: "Sunday to Thursday, 09:00–17:00",
        serviceAreas: [],
        languages: ["English"],
        tone: "Warm",
        approvedPricingFacts: [],
        faqs: [{ question: "When are you open?", answer: "Sunday to Thursday, 09:00–17:00." }],
        escalationPolicy: "Hand off when unsure",
        forbiddenClaims: [],
        ownerNotificationTarget: "Owner",
      },
      sources: [],
    });
    expect(approved).toEqual({
      answer: "Sunday to Thursday, 09:00–17:00.",
      grounded: true,
      citation: "FAQ: When are you open?",
    });

    expect(
      answerWhatsAppSandboxQuestion("Can you guarantee the treatment result?", {
        profile: approved.grounded
          ? {
              businessName: "Alfi Dental",
              description: "Dental care",
              services: [],
              hours: "",
              serviceAreas: [],
              languages: [],
              tone: "",
              approvedPricingFacts: [],
              faqs: [],
              escalationPolicy: "",
              forbiddenClaims: [],
              ownerNotificationTarget: "",
            }
          : undefined!,
        sources: [],
      }).grounded
    ).toBe(false);

    expect(
      answerWhatsAppSandboxQuestion("Can I get a refund?", {
        profile: {
          ...approved.grounded
            ? {
                businessName: "Alfi Dental",
                description: "Dental care",
                services: [],
                hours: "",
                serviceAreas: [],
                languages: [],
                tone: "",
                approvedPricingFacts: [],
                escalationPolicy: "",
                forbiddenClaims: [],
                ownerNotificationTarget: "",
              }
            : undefined!,
          faqs: [{ question: "Can I book a consultation?", answer: "Yes." }],
        },
        sources: [],
      }).grounded
    ).toBe(false);
  });

  test("always routes sensitive requests to a human even when an FAQ overlaps", () => {
    const result = answerWhatsAppSandboxQuestion("Can I get a refund?", {
      profile: {
        businessName: "Alfi Dental",
        description: "Dental care",
        services: [],
        hours: "",
        serviceAreas: [],
        languages: [],
        tone: "",
        approvedPricingFacts: [],
        faqs: [{ question: "Can I get a refund?", answer: "Refunds are automatic." }],
        escalationPolicy: "Human review",
        forbiddenClaims: [],
        ownerNotificationTarget: "Owner",
      },
      sources: [],
    });
    expect(result).toMatchObject({ grounded: false, citation: null });
  });

  test("ships a dedicated owner console for runtime, profile, knowledge, sandbox, and handoffs", () => {
    const tab = read("src/components/WhatsAppTab.tsx");
    expect(tab).toContain("WhatsAppAgentConsole");

    const console = read("src/components/WhatsAppAgentConsole.tsx");
    for (const section of [
      "Runtime",
      "Agent profile",
      "Knowledge sources",
      "Test sandbox",
      "Human handoffs",
    ]) {
      expect(console).toContain(section);
    }
    expect(console).toContain(`/api/agents/${"${agentId}"}/whatsapp/runtime`);
    expect(console).toContain(`/api/agents/${"${agentId}"}/whatsapp/sandbox`);
    expect(console).toContain("multipart/form-data");
    expect(console).toContain("This grounds Alfi with approved business information");
    expect(console).not.toMatch(/fine[- ]tun|train(?:ing|ed)? the model/i);
  });

  test("exposes admin-only runtime and conversation controls with server-side ownership checks", () => {
    const runtime = read("src/app/api/agents/[id]/whatsapp/runtime/route.ts");
    expect(runtime).toContain('requireAgentAccess(id, "admin")');
    expect(runtime).toContain("provisionWhatsAppWorkflowForConnection");
    expect(runtime).toContain("setWhatsAppWorkflowEnabledForConnection");
    expect(runtime).toContain("agent_whatsapp_knowledge_versions");
    expect(runtime).toContain("synced_knowledge_version");

    const conversation = read(
      "src/app/api/agents/[id]/whatsapp/conversations/[executionId]/route.ts"
    );
    expect(conversation).toContain('requireAgentAccess(id, "admin")');
    expect(conversation).toContain("handoffWhatsAppExecution");
    expect(conversation).toContain("resumeWhatsAppHandoff");
    expect(conversation).toContain("kapso_workflow_id");
  });

  test("runs sandbox answers against tenant-scoped approved knowledge", () => {
    const sandbox = read("src/app/api/agents/[id]/whatsapp/sandbox/route.ts");
    expect(sandbox).toContain('requireAgentAccess(id, "admin")');
    expect(sandbox).toContain("getKnowledgeState");
    expect(sandbox).toContain("answerWhatsAppSandboxQuestion");
    expect(sandbox).toContain("readySources");
    expect(sandbox).toContain("sandbox_tested_at");
  });
});
