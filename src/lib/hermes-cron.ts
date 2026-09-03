import "server-only";
import { ALFI_DEFAULT_CRON_JOBS } from "@/generated/alfi-bundle";
import { agent37, Agent37Error } from "@/lib/agent37";
import type { CronJob, CronJobInput, CronRun } from "@/lib/types";
import {
  createCronArgs,
  cronJobId,
  encodeHermesCronExec,
  normalizeCronJob,
  normalizeCronRun,
} from "@/lib/hermes-cron-core";

const LIST_JOBS_COMMAND = `python3 - <<'PY'
import json
from cron.jobs import list_jobs

jobs = list_jobs(include_disabled=True)
print(json.dumps(jobs, ensure_ascii=False, default=str))
PY`;

function listRunsCommand(jobId: string, limit: number): string {
  const encodedJobId = Buffer.from(cronJobId.parse(jobId), "utf8").toString("base64");
  return `python3 - <<'PY'
import base64, json
from datetime import datetime, timezone
from pathlib import Path
from cron.executions import list_executions
from hermes_constants import get_hermes_home

job_id = base64.b64decode('${encodedJobId}').decode('utf-8')
limit = ${Math.min(Math.max(limit, 1), 50)}
runs = list_executions(job_id=job_id, limit=limit)
output_dir = get_hermes_home() / 'cron' / 'output' / job_id
outputs = []
if output_dir.is_dir():
    for path in sorted(output_dir.glob('*.md'), key=lambda p: p.stat().st_mtime, reverse=True)[:limit]:
        try:
            content = path.read_text(encoding='utf-8', errors='replace')[:20000]
        except OSError:
            content = None
        outputs.append({
            'name': path.name,
            'mtime': datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
            'content': content,
        })
for index, run in enumerate(runs):
    item = dict(run)
    item['output'] = outputs[index]['content'] if index < len(outputs) else None
    print(json.dumps(item, ensure_ascii=False, default=str))
PY`;
}

function parseJsonArray(stdout: string): Record<string, unknown>[] {
  const parsed: unknown = JSON.parse(stdout || "[]");
  if (!Array.isArray(parsed)) throw new Agent37Error(502, "invalid_cron_response", "Hermes returned invalid schedule data");
  return parsed.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
}

function parseJsonLines(stdout: string): Record<string, unknown>[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

export async function listCronJobs(agentId: string): Promise<CronJob[]> {
  const result = await agent37.exec(agentId, LIST_JOBS_COMMAND);
  const defaultNames = new Map<string, string>(ALFI_DEFAULT_CRON_JOBS.map((job) => [job.key, job.name]));
  return parseJsonArray(result.stdout).map((raw) => {
    const job = normalizeCronJob(raw);
    return { ...job, displayName: defaultNames.get(job.name) ?? job.displayName };
  });
}

export async function listCronRuns(agentId: string, jobId: string, limit = 20): Promise<CronRun[]> {
  const result = await agent37.exec(agentId, listRunsCommand(jobId, limit));
  return parseJsonLines(result.stdout).map(normalizeCronRun);
}

export async function createCronJob(agentId: string, input: CronJobInput, skills: readonly string[] = []) {
  const result = await agent37.exec(agentId, encodeHermesCronExec(createCronArgs(input, skills)));
  return { ok: true as const, output: result.stdout.trim() };
}

export async function updateCronJob(agentId: string, jobId: string, input: CronJobInput) {
  const args = [
    "edit",
    cronJobId.parse(jobId),
    "--name",
    input.name,
    "--schedule",
    input.schedule,
    "--prompt",
    input.prompt,
    "--deliver",
    "local",
  ];
  await agent37.exec(agentId, encodeHermesCronExec(args));
  return { ok: true as const };
}

async function runAction(agentId: string, action: "pause" | "resume" | "run" | "remove", jobId: string) {
  await agent37.exec(agentId, encodeHermesCronExec([action, cronJobId.parse(jobId)]));
  return { ok: true as const };
}

export const pauseCronJob = (agentId: string, jobId: string) => runAction(agentId, "pause", jobId);
export const resumeCronJob = (agentId: string, jobId: string) => runAction(agentId, "resume", jobId);
export const runCronJob = (agentId: string, jobId: string) => runAction(agentId, "run", jobId);
export const removeCronJob = (agentId: string, jobId: string) => runAction(agentId, "remove", jobId);

export { cronActionInput, cronJobId, cronJobInput, encodeHermesCronExec } from "@/lib/hermes-cron-core";
