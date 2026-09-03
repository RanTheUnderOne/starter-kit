import { requireAgentAccess } from "@/lib/auth";
import { cronJobId, listCronRuns } from "@/lib/hermes-cron";
import { ApiError, handleError, json } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; jobId: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { id, jobId: rawJobId } = await params;
    await requireAgentAccess(id, "member");
    const jobId = cronJobId.parse(rawJobId);
    const rawLimit = new URL(request.url).searchParams.get("limit");
    const limit = rawLimit == null ? 20 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new ApiError(400, "invalid_request", "limit must be between 1 and 50");
    }
    return json({ runs: await listCronRuns(id, jobId, limit) });
  } catch (error) {
    return handleError(error);
  }
}
