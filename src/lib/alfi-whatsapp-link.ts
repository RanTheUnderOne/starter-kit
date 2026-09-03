import { branding } from "../config/branding";

export function digitsFromDisplay(value: string): string {
  return value.replace(/\D/g, "");
}

export function configuredAlfiWhatsAppDigits(
  envNumber: string | undefined = process.env.NEXT_PUBLIC_ALFI_WHATSAPP_NUMBER,
  brandNumber: string = branding.whatsappNumber,
): string {
  return digitsFromDisplay(brandNumber) || digitsFromDisplay(envNumber ?? "");
}

export function alfiWhatsAppTalkUrl(digits: string, text: string): string | null {
  const clean = digitsFromDisplay(digits);
  if (!clean) return null;
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}
