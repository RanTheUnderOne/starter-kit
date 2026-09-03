import { handleError, json } from "@/lib/http";
import { resolveAlfiWhatsAppDigits } from "@/lib/alfi-whatsapp-talk-server";

export async function GET() {
  try {
    return json({ digits: await resolveAlfiWhatsAppDigits() });
  } catch (error) {
    return handleError(error);
  }
}
