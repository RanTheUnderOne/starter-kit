import { describe, expect, test } from "vitest";
import type { AgentWhatsAppConnection } from "../src/lib/types";
import { customerWhatsAppStatus } from "../src/lib/whatsapp-public-status";

function connectionFixture(overrides: Partial<AgentWhatsAppConnection> = {}): AgentWhatsAppConnection {
  return {
    agent37_id: "agent-a",
    workspace_id: "ws-1",
    token_hash: "secret-hash",
    enabled: true,
    status: "connected",
    provisioning_status: "ready",
    provisioning_error: "kapso timeout at webhook_url",
    kapso_customer_id: "cus_123",
    kapso_setup_link_id: "setup_123",
    phone_number_id: "123456",
    business_account_id: "waba_123",
    display_phone_number: "+972 50-123-4567",
    kapso_workflow_id: null,
    kapso_trigger_id: null,
    workflow_status: null,
    trigger_active: false,
    provider_model_id: null,
    provider_model_name: null,
    workflow_provisioned_at: null,
    workflow_last_synced_at: null,
    workflow_last_error: null,
    active_knowledge_version: null,
    synced_knowledge_version: null,
    knowledge_last_synced_at: null,
    knowledge_last_error: null,
    owner_phone_e164: null,
    webhook_url: "https://wa-agent-a.agent37.app/whatsapp/webhook",
    setup_expires_at: null,
    connected_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("customer WhatsApp status", () => {
  test("omits provider and router internals", () => {
    const value = customerWhatsAppStatus(connectionFixture(), { cloudConfigured: true });
    expect(JSON.stringify(value)).not.toMatch(/kapso|token|webhook_url|business_account_id|phone_number_id/);
  });

  test("owner channel is not ready when global Meta configuration is missing", () => {
    expect(
      customerWhatsAppStatus(connectionFixture({ owner_phone_e164: "+972501234567" }), {
        cloudConfigured: false,
      }).ownerChannel.ready
    ).toBe(false);
  });
});
