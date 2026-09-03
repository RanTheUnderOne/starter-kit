import "server-only";
import type { DB } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import type { AgentWhatsAppConnection, WhatsAppConnectionPublic } from "@/lib/types";

export async function getWhatsAppConnection(db: DB, agentId: string) {
  const { data, error } = await db
    .from("agent_whatsapp_connections")
    .select("*")
    .eq("agent37_id", agentId)
    .maybeSingle();
  if (error) throw new ApiError(500, "db_error", error.message);
  if (!data) throw new ApiError(404, "not_found", "WhatsApp connection not found");
  return data as AgentWhatsAppConnection;
}

export function publicConnection(row: AgentWhatsAppConnection): WhatsAppConnectionPublic {
  const { token_hash: _tokenHash, ...safe } = row;
  return safe;
}
