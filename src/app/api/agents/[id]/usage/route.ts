import { agent37 } from "@/lib/agent37";
import { requireStaffAgentAccess } from "@/lib/auth";
import { handleError, json } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireStaffAgentAccess(id);

    const month = new URL(request.url).searchParams.get("month") || undefined;
    return json(await agent37.getUsage(id, month));
  } catch (e) {
    return handleError(e);
  }
}
