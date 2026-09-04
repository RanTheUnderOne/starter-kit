import "server-only";
import type { DB } from "@/lib/auth";
import { kapso, type KapsoWorkflow, type KapsoWorkflowExecution } from "./kapso";
import { buildWhatsAppAgentDefinition } from "./kapso-workflow-definition";
import type { AgentWhatsAppConnection } from "./types";

export interface ProvisionWhatsAppWorkflowInput {
  slug: string;
  name: string;
  phoneNumberId: string;
  businessInstructions: string;
  providerModelId?: string;
  active?: boolean;
}

export interface ProvisionedWhatsAppWorkflow {
  workflowId: string;
  triggerId: string;
  providerModelId: string;
  providerModelName: string | null;
  workflowStatus: "active";
  triggerActive: boolean;
}

type WorkflowClient = Pick<
  typeof kapso,
  | "listProviderModels"
  | "listWorkflows"
  | "createWorkflow"
  | "getWorkflow"
  | "getWorkflowDefinition"
  | "updateWorkflow"
  | "listWorkflowTriggers"
  | "replaceWorkflowTriggers"
  | "updateWorkflowTrigger"
  | "listWorkflowExecutions"
  | "getWorkflowExecution"
  | "updateWorkflowExecution"
  | "resumeWorkflowExecution"
>;

const LOW_COST_MODEL = /(?:gpt-4o-mini|gpt-4\.1-mini|gemini.*flash|haiku|mini|nano|flash)/i;

function assertId(label: string, value: string) {
  if (!value.trim()) throw new Error(`${label} is required`);
}

async function resolveProviderModel(client: WorkflowClient, requested?: string) {
  const models = await client.listProviderModels();
  if (requested) {
    const selected = models.find((model) => model.id === requested);
    if (!selected) throw new Error("The requested Kapso provider model is unavailable");
    return selected;
  }
  const selected = models.find((model) => LOW_COST_MODEL.test(model.name));
  if (!selected) {
    throw new Error(
      "No supported low-cost Kapso model was found; provide an explicit providerModelId"
    );
  }
  return selected;
}

function assertExecutionScope(execution: KapsoWorkflowExecution, workflowId: string) {
  const scoped = execution as KapsoWorkflowExecution & { workflow?: { id?: string } };
  if (scoped.workflow?.id !== workflowId) {
    throw new Error("Workflow execution is outside this business workflow");
  }
}

export async function provisionWhatsAppWorkflow(
  input: ProvisionWhatsAppWorkflowInput,
  client: WorkflowClient = kapso
): Promise<ProvisionedWhatsAppWorkflow> {
  assertId("Workflow slug", input.slug);
  assertId("Workflow name", input.name);
  assertId("WhatsApp phone number ID", input.phoneNumberId);

  const model = await resolveProviderModel(client, input.providerModelId);
  const definition = buildWhatsAppAgentDefinition({
    providerModelId: model.id,
    businessInstructions: input.businessInstructions,
  });
  // Kapso filters workflows by display name, not slug. Match the returned slug
  // locally so retries reconcile the same workflow instead of creating another.
  const matches = await client.listWorkflows({ name_contains: input.name });
  let workflow = matches.find((candidate) => candidate.slug === input.slug);

  if (!workflow) {
    workflow = await client.createWorkflow({
      name: input.name,
      slug: input.slug,
      description: "Kapso-native WhatsApp customer-response agent managed by Alfi",
      definition,
    });
  }

  workflow = await client.updateWorkflow(workflow.id, {
    name: input.name,
    status: "active",
    inbound_message_read_mode: "read_with_typing",
    message_debounce_seconds: 1,
    lock_version: workflow.lock_version,
    definition,
  });

  const desiredActive = input.active ?? false;
  await client.replaceWorkflowTriggers(workflow.id, [
    {
      trigger_type: "inbound_message",
      phone_number_id: input.phoneNumberId,
      active: desiredActive,
    },
  ]);

  const [savedWorkflow, savedDefinition, savedTriggers] = await Promise.all([
    client.getWorkflow(workflow.id),
    client.getWorkflowDefinition(workflow.id),
    client.listWorkflowTriggers(workflow.id),
  ]);
  const trigger = savedTriggers.find(
    (candidate) =>
      candidate.trigger_type === "inbound_message" &&
      candidate.triggerable?.phone_number_id === input.phoneNumberId
  );
  if (savedWorkflow.status !== "active") throw new Error("Kapso workflow activation was not persisted");
  if (!trigger || trigger.active !== desiredActive || savedTriggers.length !== 1) {
    throw new Error("Kapso inbound trigger did not reconcile to the requested state");
  }
  const nodes = (savedDefinition.definition as {
    nodes?: Array<{ id?: string; data?: { config?: { system_prompt?: unknown } } }>;
  })?.nodes;
  const savedAgent = nodes?.find((node) => node.id === "customer_agent");
  const expectedPrompt = definition.nodes.find((node) => node.id === "customer_agent")?.data.config
    .system_prompt;
  if (!savedAgent || savedAgent.data?.config?.system_prompt !== expectedPrompt) {
    throw new Error("Kapso workflow definition read-back is missing the approved Agent instructions");
  }

  return {
    workflowId: savedWorkflow.id,
    triggerId: trigger.id,
    providerModelId: model.id,
    providerModelName: model.name ?? null,
    workflowStatus: "active",
    triggerActive: trigger.active,
  };
}

export async function setWhatsAppWorkflowEnabled(
  workflowId: string,
  triggerId: string,
  active: boolean,
  client: WorkflowClient = kapso
) {
  assertId("Workflow ID", workflowId);
  assertId("Trigger ID", triggerId);
  const current = (await client.listWorkflowTriggers(workflowId)).find(
    (candidate) => candidate.id === triggerId
  );
  if (!current || current.workflow_id !== workflowId) {
    throw new Error("Kapso trigger is outside this business workflow");
  }
  const trigger = await client.updateWorkflowTrigger(triggerId, active);
  if (trigger.workflow_id !== workflowId) {
    throw new Error("Kapso trigger is outside this business workflow");
  }
  const readBack = (await client.listWorkflowTriggers(workflowId)).find(
    (candidate) => candidate.id === triggerId
  );
  if (!readBack || readBack.active !== active) {
    throw new Error("Kapso trigger state could not be verified");
  }
  return readBack;
}

export async function handoffWhatsAppExecution(
  workflowId: string,
  executionId: string,
  client: WorkflowClient = kapso
) {
  const execution = await client.getWorkflowExecution(executionId);
  assertExecutionScope(execution, workflowId);
  if (execution.status !== "handoff") {
    await client.updateWorkflowExecution(executionId, "handoff");
  }
  const readBack = await client.getWorkflowExecution(executionId);
  assertExecutionScope(readBack, workflowId);
  if (readBack.status !== "handoff") throw new Error("Kapso handoff could not be verified");
  return readBack;
}

export async function resumeWhatsAppHandoff(
  workflowId: string,
  executionId: string,
  client: WorkflowClient = kapso
) {
  const execution = await client.getWorkflowExecution(executionId);
  assertExecutionScope(execution, workflowId);
  if (execution.status === "handoff") {
    await client.updateWorkflowExecution(executionId, "waiting");
  } else if (execution.status !== "waiting") {
    throw new Error(`Cannot resume a workflow execution with status ${execution.status}`);
  }
  const readBack = await client.getWorkflowExecution(executionId);
  assertExecutionScope(readBack, workflowId);
  if (readBack.status !== "waiting") throw new Error("Kapso handoff resume could not be verified");
  return readBack;
}

export async function resumeWaitingWhatsAppExecution(
  workflowId: string,
  executionId: string,
  message: unknown,
  client: WorkflowClient = kapso
) {
  const execution = await client.getWorkflowExecution(executionId);
  assertExecutionScope(execution, workflowId);
  if (execution.status !== "waiting") throw new Error("Workflow execution is not waiting");
  await client.resumeWorkflowExecution(executionId, message);
  const readBack = await client.getWorkflowExecution(executionId);
  assertExecutionScope(readBack, workflowId);
  return readBack;
}

export async function listActiveWhatsAppHandoffs(
  workflowId: string,
  client: WorkflowClient = kapso
): Promise<KapsoWorkflowExecution[]> {
  return client.listWorkflowExecutions(workflowId, { status: "handoff", limit: 100 });
}

function workflowSlug(agentId: string) {
  const suffix = agentId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!suffix) throw new Error("Agent ID cannot be converted to a Kapso workflow slug");
  return `alfi-whatsapp-${suffix}`;
}

export async function provisionWhatsAppWorkflowForConnection(
  db: DB,
  connection: AgentWhatsAppConnection,
  businessInstructions: string,
  providerModelId?: string,
  client: WorkflowClient = kapso
) {
  if (connection.status !== "connected" || !connection.phone_number_id) {
    throw new Error("WhatsApp must be connected before its workflow can be provisioned");
  }
  const result = await provisionWhatsAppWorkflow(
    {
      slug: workflowSlug(connection.agent37_id),
      name: `Alfi WhatsApp — ${connection.agent37_id}`,
      phoneNumberId: connection.phone_number_id,
      businessInstructions,
      providerModelId,
      active: false,
    },
    client
  );
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("agent_whatsapp_connections")
    .update({
      kapso_workflow_id: result.workflowId,
      kapso_trigger_id: result.triggerId,
      workflow_status: result.workflowStatus,
      trigger_active: result.triggerActive,
      provider_model_id: result.providerModelId,
      provider_model_name: result.providerModelName,
      workflow_provisioned_at: connection.workflow_provisioned_at ?? now,
      workflow_last_synced_at: now,
      workflow_last_error: null,
      updated_at: now,
    })
    .eq("agent37_id", connection.agent37_id)
    .eq("workspace_id", connection.workspace_id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Workflow state could not be persisted");
  return data as AgentWhatsAppConnection;
}

export async function setWhatsAppWorkflowEnabledForConnection(
  db: DB,
  connection: AgentWhatsAppConnection,
  active: boolean,
  client: WorkflowClient = kapso
) {
  if (!connection.kapso_workflow_id || !connection.kapso_trigger_id) {
    throw new Error("WhatsApp workflow has not been provisioned");
  }
  await setWhatsAppWorkflowEnabled(
    connection.kapso_workflow_id,
    connection.kapso_trigger_id,
    active,
    client
  );
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("agent_whatsapp_connections")
    .update({
      trigger_active: active,
      workflow_last_synced_at: now,
      workflow_last_error: null,
      updated_at: now,
    })
    .eq("agent37_id", connection.agent37_id)
    .eq("workspace_id", connection.workspace_id)
    .eq("kapso_workflow_id", connection.kapso_workflow_id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Trigger state could not be persisted");
  return data as AgentWhatsAppConnection;
}

export type { WorkflowClient, KapsoWorkflow };
