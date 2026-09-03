import "server-only";
import { ApiError } from "@/lib/http";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ApiError(500, "config_error", `${name} is not configured`);
  return value;
}

export function kapsoApiKey() {
  return required("KAPSO_API_KEY");
}

export function kapsoWebhookSecret() {
  return required("KAPSO_PROJECT_WEBHOOK_SECRET");
}

export function mcpTokenPepper() {
  return required("ALFI_MCP_TOKEN_PEPPER");
}

export function alfiPublicUrl() {
  const url = new URL(required("ALFI_PUBLIC_URL"));
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new ApiError(500, "config_error", "ALFI_PUBLIC_URL must use HTTPS");
  }
  return url.origin;
}

export function whatsappMcpUrl() {
  return `${alfiPublicUrl()}/api/mcp/whatsapp`;
}
