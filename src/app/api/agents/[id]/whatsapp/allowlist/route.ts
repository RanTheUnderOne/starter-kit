import { requireAgentAccess } from "@/lib/auth";
import { handleError, json, readJson } from "@/lib/http";
import { whatsappCloudConfig } from "@/lib/alfi-config";
import { configureSharedWhatsApp, saveOwnerPhone } from "@/lib/whatsapp-gateway";
import { getWhatsAppConnection } from "@/lib/whatsapp-connections";
import { customerWhatsAppStatus } from "@/lib/whatsapp-public-status";

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
    return json(
      customerWhatsAppStatus(await getWhatsAppConnection(db, id), {
        cloudConfigured: Boolean(whatsappCloudConfig()),
      })
    );
  } catch (error) {
    return handleError(error);
  }
}
