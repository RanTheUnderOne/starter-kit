import "server-only";
import { whatsappCloudConfig } from "@/lib/alfi-config";
import { configuredAlfiWhatsAppDigits, digitsFromDisplay } from "@/lib/alfi-whatsapp-link";

const CACHE_MS = 6 * 60 * 60 * 1000;
let cached: { digits: string; at: number } | null = null;

async function digitsFromMetaCloud(): Promise<string | null> {
  const cloud = whatsappCloudConfig();
  if (!cloud) return null;
  const response = await fetch(
    `https://graph.facebook.com/v24.0/${encodeURIComponent(cloud.phoneNumberId)}?fields=display_phone_number`,
    {
      headers: { Authorization: `Bearer ${cloud.accessToken}` },
      cache: "no-store",
    },
  );
  if (!response.ok) return null;
  const body = (await response.json()) as { display_phone_number?: string };
  const digits = digitsFromDisplay(body.display_phone_number ?? "");
  return digits || null;
}

export async function resolveAlfiWhatsAppDigits(): Promise<string | null> {
  const configured = configuredAlfiWhatsAppDigits();
  if (configured) return configured;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.digits;
  try {
    const digits = await digitsFromMetaCloud();
    if (!digits) return null;
    cached = { digits, at: Date.now() };
    return digits;
  } catch {
    return null;
  }
}
