import { requireAgentAccess } from "@/lib/auth";
import { ApiError, handleError, json } from "@/lib/http";
import { kapso } from "@/lib/kapso";
import { getWhatsAppConnection, publicConnection } from "@/lib/whatsapp-connections";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db } = await requireAgentAccess(id, "admin");
    const connection = await getWhatsAppConnection(db, id);
    if (!connection.kapso_customer_id || !connection.kapso_setup_link_id) {
      throw new ApiError(409, "not_connecting", "No WhatsApp setup is in progress");
    }

    const setup = await kapso.getSetupLink(
      connection.kapso_customer_id,
      connection.kapso_setup_link_id
    );
    const completed = setup.whatsapp_setup_status === "completed";
    const failed = setup.whatsapp_setup_status === "failed";
    const status = completed ? "connected" : failed ? "failed" : "connecting";
    const { error } = await db
      .from("agent_whatsapp_connections")
      .update({
        status,
        phone_number_id: completed ? setup.phone_number_id ?? connection.phone_number_id : connection.phone_number_id,
        business_account_id: completed
          ? setup.business_account_id ?? connection.business_account_id
          : connection.business_account_id,
        display_phone_number: completed
          ? setup.display_phone_number ?? connection.display_phone_number
          : connection.display_phone_number,
        connected_at: completed ? connection.connected_at ?? new Date().toISOString() : connection.connected_at,
        provisioning_error: failed ? setup.whatsapp_setup_error ?? "WhatsApp setup failed" : connection.provisioning_error,
        updated_at: new Date().toISOString(),
      })
      .eq("agent37_id", id);
    if (error) throw new ApiError(500, "db_error", error.message);
    return json(publicConnection(await getWhatsAppConnection(db, id)));
  } catch (error) {
    return handleError(error);
  }
}
