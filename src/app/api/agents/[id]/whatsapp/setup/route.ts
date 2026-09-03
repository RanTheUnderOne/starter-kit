import { alfiPublicUrl } from "@/lib/alfi-config";
import { requireAgentAccess } from "@/lib/auth";
import { handleError, json } from "@/lib/http";
import { kapso } from "@/lib/kapso";
import { canReuseSetupLink } from "@/lib/kapso-lifecycle";
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
      const { data: claimed } = await db
        .from("agent_whatsapp_connections")
        .update({
          kapso_customer_id: `pending:${id}`,
          updated_at: new Date().toISOString(),
        })
        .eq("agent37_id", id)
        .is("kapso_customer_id", null)
        .select("agent37_id");
      if (!claimed?.length) {
        customerId = (await getWhatsAppConnection(db, id)).kapso_customer_id;
      } else {
        const customer = await kapso.createCustomer(row.name || "Alfi customer", id);
        customerId = customer.id;
        await db
          .from("agent_whatsapp_connections")
          .update({ kapso_customer_id: customerId, updated_at: new Date().toISOString() })
          .eq("agent37_id", id);
      }
    }

    if (!customerId || customerId.startsWith("pending:")) {
      const fresh = await getWhatsAppConnection(db, id);
      customerId = fresh.kapso_customer_id;
    }
    if (!customerId || customerId.startsWith("pending:")) {
      throw new Error("WhatsApp setup is already starting");
    }

    const origin = alfiPublicUrl();
    if (
      connection.kapso_setup_link_id &&
      canReuseSetupLink(connection.setup_expires_at) &&
      customerId === connection.kapso_customer_id
    ) {
      const existing = await kapso.getSetupLink(customerId, connection.kapso_setup_link_id);
      if (existing.url) {
        return json({ url: existing.url, expires_at: existing.expires_at ?? connection.setup_expires_at });
      }
    }

    const setup = await kapso.createSetupLink(customerId, {
      origin,
      success: `${origin}/dashboard/agents/${encodeURIComponent(id)}/whatsapp?whatsapp=success`,
      failure: `${origin}/dashboard/agents/${encodeURIComponent(id)}/whatsapp?whatsapp=failed`,
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
