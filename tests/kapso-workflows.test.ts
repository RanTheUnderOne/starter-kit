import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  WHATSAPP_AGENT_TOOLS,
  buildWhatsAppAgentDefinition,
  isWithinWhatsAppServiceWindow,
} from "../src/lib/kapso-workflow-definition";
import {
  handoffWhatsAppExecution,
  provisionWhatsAppWorkflow,
  resumeWaitingWhatsAppExecution,
  resumeWhatsAppHandoff,
  setWhatsAppWorkflowEnabled,
  type WorkflowClient,
} from "../src/lib/kapso-workflows";

function workflowClient() {
  const workflow = {
    id: "workflow-1",
    name: "Support bot",
    slug: "support-bot",
    status: "active" as const,
    lock_version: 3,
  };
  const trigger = {
    id: "trigger-1",
    workflow_id: workflow.id,
    trigger_type: "inbound_message" as const,
    active: false,
    triggerable: { phone_number_id: "phone-1" },
  };
  const definition = buildWhatsAppAgentDefinition({
    providerModelId: "model-1",
    businessInstructions: "We sell blue widgets.",
  });
  return {
    listProviderModels: vi.fn().mockResolvedValue([{ id: "model-1", name: "GPT-4o mini" }]),
    listWorkflows: vi.fn().mockResolvedValue([workflow]),
    createWorkflow: vi.fn().mockResolvedValue(workflow),
    getWorkflow: vi.fn().mockResolvedValue(workflow),
    getWorkflowDefinition: vi.fn().mockResolvedValue({ ...workflow, definition }),
    updateWorkflow: vi.fn().mockResolvedValue(workflow),
    listWorkflowTriggers: vi.fn().mockResolvedValue([trigger]),
    replaceWorkflowTriggers: vi.fn().mockResolvedValue([trigger]),
    updateWorkflowTrigger: vi.fn().mockImplementation(async (_id: string, active: boolean) => ({
      ...trigger,
      active,
    })),
    listWorkflowExecutions: vi.fn().mockResolvedValue([]),
    getWorkflowExecution: vi.fn(),
    updateWorkflowExecution: vi.fn(),
    resumeWorkflowExecution: vi.fn(),
  };
}

describe("Kapso WhatsApp workflow definition", () => {
  test("builds only Start -> Agent with the approved bounded toolset", () => {
    const definition = buildWhatsAppAgentDefinition({
      providerModelId: " model-1 ",
      businessInstructions: " Only answer from this catalog. ",
    });

    expect(definition.nodes.map((node) => node.data.node_type)).toEqual(["start", "agent"]);
    expect(definition.edges).toEqual([
      { source: "start", target: "customer_agent", label: "next", type: "default" },
    ]);
    expect(definition.nodes[1].data.config).toMatchObject({
      provider_model_id: "model-1",
      max_iterations: 12,
      max_tokens: 1200,
      message_delivery_mode: "tool_only",
      enabled_default_tools: [...WHATSAPP_AGENT_TOOLS],
      sandbox_enabled: false,
    });
    expect(definition.nodes[1].data.config.system_prompt).toContain(
      "then call enter_waiting"
    );
    expect(definition.nodes[1].data.config.system_prompt).toContain(
      "24-hour customer-service window"
    );
  });

  test("treats exactly 24 hours as outside the WhatsApp service window", () => {
    const now = new Date("2026-01-02T00:00:00.000Z");
    expect(isWithinWhatsAppServiceWindow("2026-01-01T00:00:00.001Z", now)).toBe(true);
    expect(isWithinWhatsAppServiceWindow("2026-01-01T00:00:00.000Z", now)).toBe(false);
    expect(isWithinWhatsAppServiceWindow("invalid", now)).toBe(false);
    expect(isWithinWhatsAppServiceWindow("2026-01-02T00:00:00.001Z", now)).toBe(false);
  });
});

describe("Kapso WhatsApp workflow runtime", () => {
  beforeEach(() => vi.clearAllMocks());

  test("reconciles an existing workflow by name without creating a duplicate", async () => {
    const client = workflowClient();
    client.listWorkflows.mockImplementation(async (query) =>
      query.name_contains === "Support bot"
        ? [
            {
              id: "workflow-1",
              name: "Support bot",
              slug: "support-bot",
              status: "active" as const,
              lock_version: 3,
            },
          ]
        : []
    );

    const result = await provisionWhatsAppWorkflow(
      {
        slug: "support-bot",
        name: "Support bot",
        phoneNumberId: "phone-1",
        businessInstructions: "We sell blue widgets.",
      },
      client as unknown as WorkflowClient
    );

    expect(client.listWorkflows).toHaveBeenCalledWith({ name_contains: "Support bot" });
    expect(client.createWorkflow).not.toHaveBeenCalled();
    expect(client.updateWorkflow).toHaveBeenCalledWith(
      "workflow-1",
      expect.objectContaining({ status: "active", lock_version: 3 })
    );
    expect(client.replaceWorkflowTriggers).toHaveBeenCalledWith("workflow-1", [
      { trigger_type: "inbound_message", phone_number_id: "phone-1", active: false },
    ]);
    expect(result).toMatchObject({ workflowId: "workflow-1", triggerId: "trigger-1" });
  });

  test("verifies master trigger changes by reading the owning workflow back", async () => {
    const client = workflowClient();
    client.listWorkflowTriggers.mockResolvedValue([
      {
        id: "trigger-1",
        workflow_id: "workflow-1",
        trigger_type: "inbound_message",
        active: true,
        triggerable: { phone_number_id: "phone-1" },
      },
    ]);

    await expect(
      setWhatsAppWorkflowEnabled(
        "workflow-1",
        "trigger-1",
        true,
        client as unknown as WorkflowClient
      )
    ).resolves.toMatchObject({ active: true });
  });

  test("hands off and resumes only executions owned by the workflow", async () => {
    const client = workflowClient();
    client.getWorkflowExecution
      .mockResolvedValueOnce({ id: "execution-1", status: "waiting", workflow: { id: "workflow-1" } })
      .mockResolvedValueOnce({ id: "execution-1", status: "handoff", workflow: { id: "workflow-1" } })
      .mockResolvedValueOnce({ id: "execution-1", status: "handoff", workflow: { id: "workflow-1" } })
      .mockResolvedValueOnce({ id: "execution-1", status: "waiting", workflow: { id: "workflow-1" } })
      .mockResolvedValueOnce({ id: "execution-1", status: "waiting", workflow: { id: "workflow-1" } })
      .mockResolvedValueOnce({ id: "execution-1", status: "running", workflow: { id: "workflow-1" } });

    await handoffWhatsAppExecution(
      "workflow-1",
      "execution-1",
      client as unknown as WorkflowClient
    );
    await resumeWhatsAppHandoff(
      "workflow-1",
      "execution-1",
      client as unknown as WorkflowClient
    );
    await resumeWaitingWhatsAppExecution(
      "workflow-1",
      "execution-1",
      { text: "continue" },
      client as unknown as WorkflowClient
    );

    expect(client.updateWorkflowExecution).toHaveBeenNthCalledWith(1, "execution-1", "handoff");
    expect(client.updateWorkflowExecution).toHaveBeenNthCalledWith(2, "execution-1", "waiting");
    expect(client.resumeWorkflowExecution).toHaveBeenCalledWith("execution-1", {
      text: "continue",
    });
  });

  test("rejects a cross-workflow execution before mutating it", async () => {
    const client = workflowClient();
    client.getWorkflowExecution.mockResolvedValue({
      id: "execution-2",
      status: "waiting",
      workflow: { id: "another-workflow" },
    });

    await expect(
      handoffWhatsAppExecution(
        "workflow-1",
        "execution-2",
        client as unknown as WorkflowClient
      )
    ).rejects.toThrow("outside this business workflow");
    expect(client.updateWorkflowExecution).not.toHaveBeenCalled();
  });
});
