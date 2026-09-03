import { requireAgentAccess } from "@/lib/auth";
import { createCronJob, cronJobInput, listCronJobs } from "@/lib/hermes-cron";
import { handleError, json, readJson } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireAgentAccess(id, "member");
    return json({ jobs: await listCronJobs(id), timezone: "Asia/Jerusalem" });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireAgentAccess(id, "admin");
    const input = cronJobInput.parse(await readJson(request));
    await createCronJob(id, input);
    return json({ jobs: await listCronJobs(id) }, 201);
  } catch (error) {
    return handleError(error);
  }
}

