import { requireAgentAccess } from "@/lib/auth";
import { handleError, json } from "@/lib/http";
import { whatsappCloudConfig } from "@/lib/alfi-config";
import { getWhatsAppConnection } from "@/lib/whatsapp-connections";
import { customerWhatsAppStatus } from "@/lib/whatsapp-public-status";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db } = await requireAgentAccess(id);
    const connection = await getWhatsAppConnection(db, id);
    return json(
      customerWhatsAppStatus(connection, { cloudConfigured: Boolean(whatsappCloudConfig()) })
    );
  } catch (error) {
    return handleError(error);
  }
}
