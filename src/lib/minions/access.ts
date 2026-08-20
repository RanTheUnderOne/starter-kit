import { isAlfiAgentTemplate } from "@/config/agents";
import { requireAgentAccess } from "@/lib/auth";
import { ApiError } from "@/lib/http";

export async function requireMinionsAccess(id: string, access: "member" | "admin" = "member") {
  const result = await requireAgentAccess(id, access);
  const { row } = result;
  if (!isAlfiAgentTemplate(row.template)) {
    throw new ApiError(404, "not_found", "Minions is not available for this agent");
  }
  return result;
}
