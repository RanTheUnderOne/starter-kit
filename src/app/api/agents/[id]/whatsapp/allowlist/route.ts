import { requireAgentAccess } from "@/lib/auth";
import { handleError, json, readJson } from "@/lib/http";
import { configureSharedWhatsApp, saveOwnerPhone } from "@/lib/whatsapp-gateway";
import { getWhatsAppConnection, publicConnection } from "@/lib/whatsapp-connections";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db } = await requireAgentAccess(id, "admin");
    const body = await readJson<{ phone?: string }>(request);
    await saveOwnerPhone(db, id, body.phone ?? "");
    await configureSharedWhatsApp(db, id);
    return json(publicConnection(await getWhatsAppConnection(db, id)));
  } catch (error) {
    return handleError(error);
  }
}
