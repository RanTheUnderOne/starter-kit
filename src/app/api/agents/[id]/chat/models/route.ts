import { agent37 } from "@/lib/agent37";
import { requireStaffAgentAccess } from "@/lib/auth";
import { handleError, json } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

// List the models this agent can run, for the composer's model switcher.
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireStaffAgentAccess(id);

    return json(await agent37.listModels(id));
  } catch (e) {
    return handleError(e);
  }
}
