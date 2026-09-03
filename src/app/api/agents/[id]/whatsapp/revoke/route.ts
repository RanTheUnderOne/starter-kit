import { requireAgentAccess } from "@/lib/auth";
import { ApiError, handleError, json } from "@/lib/http";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db } = await requireAgentAccess(id, "admin");
    const { error } = await db
      .from("agent_whatsapp_connections")
      .update({
        enabled: false,
        status: "revoked",
        updated_at: new Date().toISOString(),
      })
      .eq("agent37_id", id);
    if (error) throw new ApiError(500, "db_error", error.message);
    return json({ revoked: true });
  } catch (error) {
    return handleError(error);
  }
}
