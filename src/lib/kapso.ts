import "server-only";
import { kapsoApiKey } from "@/lib/alfi-config";
import { ApiError } from "@/lib/http";

const PLATFORM = "https://api.kapso.ai/platform/v1";
const WHATSAPP = "https://api.kapso.ai/meta/whatsapp/v24.0";

type Query = Record<string, string | number | boolean | undefined>;

function queryString(query: Query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const value = params.toString();
  return value ? `?${value}` : "";
}

async function kapsoFetch<T>(base: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "X-API-Key": kapsoApiKey(),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (!response.ok) {
    const source = body as { error?: string | { message?: string }; message?: string };
    const message =
      typeof source.error === "string"
        ? source.error
        : source.error?.message ?? source.message ?? "Kapso request failed";
    const status = response.status === 429 ? 429 : response.status >= 500 ? 502 : 400;
    throw new ApiError(status, response.status === 429 ? "rate_limited" : "kapso_error", message);
  }
  return body as T;
}

export interface KapsoCustomer {
  id: string;
  name: string;
  external_customer_id: string;
}

export interface KapsoSetupLink {
  id: string;
  url: string;
  status: string;
  expires_at?: string;
  whatsapp_setup_status?: string;
  whatsapp_setup_error?: string | null;
  phone_number_id?: string | null;
  business_account_id?: string | null;
  display_phone_number?: string | null;
}

export interface KapsoWorkflow {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "active" | "archived";
  lock_version: number;
}

export interface KapsoWorkflowTrigger {
  id: string;
  workflow_id: string;
  trigger_type: "inbound_message" | "api_call" | "whatsapp_event" | "project_event";
  active: boolean;
  triggerable?: { phone_number_id?: string };
}

export interface KapsoWorkflowExecution {
  id: string;
  status: "running" | "waiting" | "ended" | "failed" | "handoff";
  tracking_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  whatsapp_conversation_id?: string | null;
  workflow: { id: string; name?: string; slug?: string };
  current_step?: { id?: string; name?: string; node_type?: string } | null;
  execution_context?: Record<string, unknown>;
  error_details?: Record<string, unknown> | null;
}

export interface KapsoWorkflowExecutionAccepted {
  message: string;
  workflow_id: string;
  id: string;
  tracking_id: string;
}

export const kapso = {
  createCustomer: async (name: string, externalCustomerId: string) => {
    const result = await kapsoFetch<{ data: KapsoCustomer }>(PLATFORM, "/customers", {
      method: "POST",
      body: JSON.stringify({
        customer: { name, external_customer_id: externalCustomerId },
      }),
    });
    return result.data;
  },

  createSetupLink: async (
    customerId: string,
    redirects: { success: string; failure: string; origin: string }
  ) => {
    const result = await kapsoFetch<{ data: KapsoSetupLink }>(
      PLATFORM,
      `/customers/${encodeURIComponent(customerId)}/setup_links`,
      {
        method: "POST",
        body: JSON.stringify({
          setup_link: {
            success_redirect_url: redirects.success,
            failure_redirect_url: redirects.failure,
            allowed_origins: [redirects.origin],
            meta_billing_mode: "partner_managed",
            allowed_connection_types: ["coexistence"],
          },
        }),
      }
    );
    return result.data;
  },

  getSetupLink: async (customerId: string, setupLinkId: string) => {
    const result = await kapsoFetch<{ data: KapsoSetupLink }>(
      PLATFORM,
      `/customers/${encodeURIComponent(customerId)}/setup_links/${encodeURIComponent(setupLinkId)}`
    );
    return result.data;
  },

  getPhoneNumber: async (phoneNumberId: string) => {
    const result = await kapsoFetch<{
      data: {
        phone_number_id: string;
        business_account_id?: string | null;
        display_phone_number?: string | null;
      };
    }>(PLATFORM, `/whatsapp/phone_numbers/${encodeURIComponent(phoneNumberId)}`);
    return result.data;
  },

  listProviderModels: async () => {
    const result = await kapsoFetch<{
      data: Array<{ id: string; name: string; provider?: string | null }>;
    }>(PLATFORM, "/provider_models");
    return result.data;
  },

  listWorkflows: async (query: Query = {}) => {
    const result = await kapsoFetch<{ data: KapsoWorkflow[] }>(
      PLATFORM,
      `/workflows${queryString(query)}`
    );
    return result.data;
  },

  createWorkflow: async (workflow: Record<string, unknown>) => {
    const result = await kapsoFetch<{ data: KapsoWorkflow }>(PLATFORM, "/workflows", {
      method: "POST",
      body: JSON.stringify({ workflow }),
    });
    return result.data;
  },

  getWorkflow: async (workflowId: string) => {
    const result = await kapsoFetch<{ data: KapsoWorkflow }>(
      PLATFORM,
      `/workflows/${encodeURIComponent(workflowId)}`
    );
    return result.data;
  },

  getWorkflowDefinition: async (workflowId: string) => {
    const result = await kapsoFetch<{ data: KapsoWorkflow & { definition: unknown } }>(
      PLATFORM,
      `/workflows/${encodeURIComponent(workflowId)}/definition`
    );
    return result.data;
  },

  updateWorkflow: async (workflowId: string, workflow: Record<string, unknown>) => {
    const result = await kapsoFetch<{ data: KapsoWorkflow }>(
      PLATFORM,
      `/workflows/${encodeURIComponent(workflowId)}`,
      { method: "PATCH", body: JSON.stringify({ workflow }) }
    );
    return result.data;
  },

  listWorkflowTriggers: async (workflowId: string) => {
    const result = await kapsoFetch<{ data: KapsoWorkflowTrigger[] }>(
      PLATFORM,
      `/workflows/${encodeURIComponent(workflowId)}/triggers`
    );
    return result.data;
  },

  replaceWorkflowTriggers: async (
    workflowId: string,
    triggers: Array<Record<string, unknown>>
  ) => {
    const result = await kapsoFetch<{ data: KapsoWorkflowTrigger[] }>(
      PLATFORM,
      `/workflows/${encodeURIComponent(workflowId)}/triggers`,
      { method: "PUT", body: JSON.stringify({ triggers }) }
    );
    return result.data;
  },

  updateWorkflowTrigger: async (triggerId: string, active: boolean) => {
    const result = await kapsoFetch<{ data: KapsoWorkflowTrigger }>(
      PLATFORM,
      `/triggers/${encodeURIComponent(triggerId)}`,
      { method: "PATCH", body: JSON.stringify({ trigger: { active } }) }
    );
    return result.data;
  },

  listWorkflowExecutions: async (workflowId: string, query: Query = {}) => {
    const result = await kapsoFetch<{ data: KapsoWorkflowExecution[] }>(
      PLATFORM,
      `/workflows/${encodeURIComponent(workflowId)}/executions${queryString(query)}`
    );
    return result.data;
  },

  createWorkflowExecution: async (
    workflowId: string,
    workflowExecution: {
      phone_number?: string;
      recipient?: string;
      phone_number_id?: string;
      variables?: Record<string, unknown>;
      context?: Record<string, unknown>;
      initial_data?: Record<string, unknown>;
    }
  ) => {
    const result = await kapsoFetch<{ data: KapsoWorkflowExecutionAccepted }>(
      PLATFORM,
      `/workflows/${encodeURIComponent(workflowId)}/executions`,
      {
        method: "POST",
        body: JSON.stringify({ workflow_execution: workflowExecution }),
      }
    );
    return result.data;
  },

  getWorkflowExecution: async (executionId: string) => {
    const result = await kapsoFetch<{ data: KapsoWorkflowExecution }>(
      PLATFORM,
      `/workflow_executions/${encodeURIComponent(executionId)}`
    );
    return result.data;
  },

  updateWorkflowExecution: async (
    executionId: string,
    status: "ended" | "handoff" | "waiting"
  ) => {
    const result = await kapsoFetch<{ data: KapsoWorkflowExecution }>(
      PLATFORM,
      `/workflow_executions/${encodeURIComponent(executionId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ workflow_execution: { status } }),
      }
    );
    return result.data;
  },

  resumeWorkflowExecution: async (
    executionId: string,
    message: unknown,
    variables?: Record<string, unknown>
  ) => {
    const result = await kapsoFetch<{ data: KapsoWorkflowExecution }>(
      PLATFORM,
      `/workflow_executions/${encodeURIComponent(executionId)}/resume`,
      {
        method: "POST",
        body: JSON.stringify({
          message: { kind: "payload", data: message },
          ...(variables ? { variables } : {}),
        }),
      }
    );
    return result.data;
  },

  listConversations: (phoneNumberId: string, query: Query) =>
    kapsoFetch(PLATFORM, `/whatsapp/conversations${queryString({ ...query, phone_number_id: phoneNumberId })}`),
  getConversation: (id: string, phoneNumberId: string) =>
    kapsoFetch(
      PLATFORM,
      `/whatsapp/conversations/${encodeURIComponent(id)}${queryString({ phone_number_id: phoneNumberId })}`
    ),
  listMessages: (phoneNumberId: string, query: Query) =>
    kapsoFetch(PLATFORM, `/whatsapp/messages${queryString({ ...query, phone_number_id: phoneNumberId })}`),
  getMessage: (id: string, phoneNumberId: string) =>
    kapsoFetch(PLATFORM, `/whatsapp/messages/${encodeURIComponent(id)}${queryString({ phone_number_id: phoneNumberId })}`),
  listTemplates: (businessAccountId: string, query: Query) =>
    kapsoFetch(
      WHATSAPP,
      `/${encodeURIComponent(businessAccountId)}/message_templates${queryString(query)}`
    ),

  send: (phoneNumberId: string, payload: Record<string, unknown>) =>
    kapsoFetch(WHATSAPP, `/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    }),

  markRead: (phoneNumberId: string, messageId: string) =>
    kapsoFetch(WHATSAPP, `/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "PUT",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    }),
};
