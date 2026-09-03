import { z } from "zod";
import type { CronJob, CronJobInput, CronRun } from "@/lib/types";

const CRON_FIELD = /^[A-Za-z0-9*/?,\-]+$/;
const RELATIVE_SCHEDULE = /^\d+[mhdw]$/i;
const INTERVAL_SCHEDULE = /^every\s+\d+\s*[mhdw]$/i;
const ISO_SCHEDULE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?$/;

export function isSupportedCronSchedule(value: string): boolean {
  const schedule = value.trim();
  if (RELATIVE_SCHEDULE.test(schedule) || INTERVAL_SCHEDULE.test(schedule) || ISO_SCHEDULE.test(schedule)) {
    return true;
  }
  const fields = schedule.split(/\s+/);
  return fields.length === 5 && fields.every((field) => CRON_FIELD.test(field));
}

export const cronJobId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, "Invalid scheduled job id");

export const cronJobInput = z.object({
  name: z.string().trim().min(1).max(120),
  schedule: z.string().trim().min(1).max(160).refine(isSupportedCronSchedule, "Invalid schedule"),
  prompt: z.string().trim().min(1).max(20_000),
});

export const cronActionInput = z.object({
  action: z.enum(["pause", "resume", "run"]),
});

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function inferState(job: Record<string, unknown>): CronJob["state"] {
  const explicit = nullableString(job.state)?.toLowerCase();
  if (["scheduled", "paused", "completed", "running", "error"].includes(explicit ?? "")) {
    return explicit as CronJob["state"];
  }
  if (job.enabled === false) return "paused";
  const status = nullableString(job.last_status)?.toLowerCase();
  if (status === "running" || status === "claimed") return "running";
  if (status === "failed" || status === "error") return "error";
  if (status === "completed" && job.next_run_at == null) return "completed";
  return "scheduled";
}

export function normalizeCronJob(job: Record<string, unknown>): CronJob {
  const id = cronJobId.parse(job.id);
  const name = nullableString(job.name) ?? id;
  const displayName = nullableString(job.display_name) ?? name.replace(/^alfi:/, "").replace(/-/g, " ");
  return {
    id,
    name,
    displayName,
    prompt: nullableString(job.prompt) ?? "",
    schedule:
      nullableString(job.schedule_display) ??
      nullableString(job.schedule) ??
      (job.schedule && typeof job.schedule === "object"
        ? nullableString((job.schedule as Record<string, unknown>).display) ??
          nullableString((job.schedule as Record<string, unknown>).value) ??
          nullableString((job.schedule as Record<string, unknown>).expr) ??
          nullableString((job.schedule as Record<string, unknown>).run_at) ??
          ""
        : ""),
    state: inferState(job),
    enabled: job.enabled !== false,
    nextRunAt: nullableString(job.next_run_at),
    lastRunAt: nullableString(job.last_run_at),
    lastStatus: nullableString(job.last_status) ?? nullableString(job.last_run_status),
    lastError: nullableString(job.last_error) ?? nullableString(job.last_run_error),
    skills: stringList(job.skills),
    managedDefault: name.startsWith("alfi:"),
  };
}

export function normalizeCronRun(run: Record<string, unknown>): CronRun {
  return {
    id: typeof run.id === "string" ? run.id : "unknown",
    jobId: cronJobId.parse(run.job_id),
    status: nullableString(run.status) ?? "unknown",
    claimedAt: nullableString(run.claimed_at),
    startedAt: nullableString(run.started_at),
    finishedAt: nullableString(run.finished_at),
    error: nullableString(run.error),
    output: nullableString(run.output),
  };
}

export function encodeHermesCronExec(args: readonly string[]): string {
  const payload = Buffer.from(JSON.stringify(args), "utf8").toString("base64");
  return [
    "python3 - <<'PY'",
    "import base64, json, subprocess, sys",
    `args = json.loads(base64.b64decode('${payload}').decode('utf-8'))`,
    "result = subprocess.run(['hermes', 'cron', *args], capture_output=True, text=True, check=False)",
    "sys.stdout.write(result.stdout)",
    "sys.stderr.write(result.stderr)",
    "raise SystemExit(result.returncode)",
    "PY",
  ].join("\n");
}

export function createCronArgs(input: CronJobInput, skills: readonly string[] = []): string[] {
  return [
    "create",
    input.schedule,
    input.prompt,
    "--name",
    input.name,
    "--deliver",
    "local",
    ...skills.flatMap((skill) => ["--skill", skill]),
  ];
}
