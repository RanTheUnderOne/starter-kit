import { requireAgentAccess } from "@/lib/auth";
import {
  cronActionInput,
  cronJobId,
  pauseCronJob,
  resumeCronJob,
  runCronJob,
} from "@/lib/hermes-cron";
import { handleError, json, readJson } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; jobId: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id, jobId: rawJobId } = await params;
    await requireAgentAccess(id, "admin");
    const jobId = cronJobId.parse(rawJobId);
    const { action } = cronActionInput.parse(await readJson(request));

    if (action === "pause") await pauseCronJob(id, jobId);
    else if (action === "resume") await resumeCronJob(id, jobId);
    else await runCronJob(id, jobId);

    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

