import { alfiPublicUrl } from "@/lib/alfi-config";
import { requireAgentAccess } from "@/lib/auth";
import { handleError, json } from "@/lib/http";
import { kapso } from "@/lib/kapso";
import { getWhatsAppConnection } from "@/lib/whatsapp-connections";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db, row } = await requireAgentAccess(id, "admin");
    const connection = await getWhatsAppConnection(db, id);
    let customerId = connection.kapso_customer_id;
    if (!customerId) {
      const customer = await kapso.createCustomer(row.name || "Alfi customer", id);
      customerId = customer.id;
    }

    const origin = alfiPublicUrl();
    const setup = await kapso.createSetupLink(customerId, {
      origin,
      success: `${origin}/dashboard/agents/${encodeURIComponent(id)}/settings?whatsapp=success`,
      failure: `${origin}/dashboard/agents/${encodeURIComponent(id)}/settings?whatsapp=failed`,
    });

    const { error } = await db
      .from("agent_whatsapp_connections")
      .update({
        kapso_customer_id: customerId,
        kapso_setup_link_id: setup.id,
        status: "connecting",
        setup_expires_at: setup.expires_at ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("agent37_id", id);
    if (error) throw error;
    return json({ url: setup.url, expires_at: setup.expires_at ?? null });
  } catch (error) {
    return handleError(error);
  }
}
