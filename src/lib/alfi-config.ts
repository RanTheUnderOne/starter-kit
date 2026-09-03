import "server-only";
import { resolveAlfiPublicOrigin } from "@/lib/alfi-public-url";
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
  const origin = resolveAlfiPublicOrigin();
  if (!origin) {
    throw new ApiError(500, "config_error", "ALFI_PUBLIC_URL is not configured");
  }
  return origin;
}

export function whatsappMcpUrl() {
  return `${alfiPublicUrl()}/api/mcp/whatsapp`;
}

export function metaAppSecret() {
  return required("META_APP_SECRET");
}

export function metaVerifyToken() {
  return required("META_VERIFY_TOKEN");
}

export function whatsappCloudConfig() {
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim();
  const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const verifyToken = process.env.META_VERIFY_TOKEN?.trim();
  if (!phoneNumberId || !accessToken || !appSecret || !verifyToken) return null;
  return { phoneNumberId, accessToken, appSecret, verifyToken };
}
