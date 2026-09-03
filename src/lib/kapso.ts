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
