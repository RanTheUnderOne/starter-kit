import type { CronJob, CronRun } from "@/lib/types";

const MAX_OUTPUT = 2000;

export function formatCronResultContext(
  job: Pick<CronJob, "displayName">,
  run: Pick<CronRun, "output">
): string {
  const name = job.displayName.replace(/\s+/g, " ").trim() || "Schedule";
  const raw = (run.output ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const clipped = raw.length > MAX_OUTPUT ? `${raw.slice(0, MAX_OUTPUT).trimEnd()}…` : raw;
  const quoted = clipped.split("\n").map((line) => `> ${line}`).join("\n");
  return `Scheduled result — ${name}\n\n${quoted}\n\n`;
}
