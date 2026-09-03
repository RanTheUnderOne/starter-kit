import type { AgentWhatsAppConnection, WhatsAppCustomerStatus } from "./types";
import { trustedForwardUrl } from "./whatsapp-router";

export function customerWhatsAppStatus(
  connection: AgentWhatsAppConnection,
  options: { cloudConfigured: boolean; hermesHealthy?: boolean }
): WhatsAppCustomerStatus {
  const routingReady = Boolean(trustedForwardUrl(connection.agent37_id, connection.webhook_url));
  return {
    business: {
      status: connection.status,
      displayNumber: connection.display_phone_number,
      canSetup: connection.status !== "connected",
      connected: connection.status === "connected",
    },
    ownerChannel: {
      ownerPhone: connection.owner_phone_e164,
      ready: Boolean(
        connection.owner_phone_e164 &&
          options.cloudConfigured &&
          (options.hermesHealthy ?? true) &&
          connection.provisioning_status === "ready" &&
          routingReady
      ),
    },
  };
}
