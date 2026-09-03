import { requireAgentAccess } from "@/lib/auth";
import { cronJobId, cronJobInput, listCronJobs, removeCronJob, updateCronJob } from "@/lib/hermes-cron";
import { ApiError, handleError, json, readJson } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; jobId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id, jobId: rawJobId } = await params;
    await requireAgentAccess(id, "admin");
    const jobId = cronJobId.parse(rawJobId);
    const input = cronJobInput.parse(await readJson(request));
    const existing = (await listCronJobs(id)).find((job) => job.id === jobId);
    if (!existing) throw new ApiError(404, "not_found", "Scheduled job not found");

    // Repository defaults keep their stable internal key so provisioning never overwrites edits.
    await updateCronJob(id, jobId, {
      ...input,
      name: existing.managedDefault ? existing.name : input.name,
    });
    return json({ jobs: await listCronJobs(id) });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id, jobId: rawJobId } = await params;
    await requireAgentAccess(id, "admin");
    const jobId = cronJobId.parse(rawJobId);
    await removeCronJob(id, jobId);
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

