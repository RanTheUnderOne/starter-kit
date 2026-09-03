import { requireAgentAccess } from "@/lib/auth";
import { handleError, json } from "@/lib/http";
import { getWhatsAppConnection, publicConnection } from "@/lib/whatsapp-connections";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db } = await requireAgentAccess(id);
    return json(publicConnection(await getWhatsAppConnection(db, id)));
  } catch (error) {
    return handleError(error);
  }
}
