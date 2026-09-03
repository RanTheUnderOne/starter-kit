import { describe, expect, test } from "vitest";
import { formatCronResultContext } from "../src/lib/cron-result-context";
import type { CronJob, CronRun } from "../src/lib/types";

function job(displayName: string): CronJob {
  return {
    id: "job-1",
    name: displayName,
    displayName,
    schedule: "0 8 * * *",
    prompt: "Review sales",
    state: "scheduled",
    enabled: true,
    nextRunAt: null,
    lastRunAt: null,
    lastStatus: null,
    lastError: null,
    skills: [],
    managedDefault: false,
  };
}

function run(output: string): CronRun {
  return {
    id: "run-1",
    jobId: "job-1",
    status: "ok",
    claimedAt: null,
    startedAt: null,
    finishedAt: null,
    error: null,
    output,
  };
}

describe("cron result context", () => {
  test("identifies the job and preserves the result", () => {
    expect(formatCronResultContext(job("Morning sales review"), run("Three leads need follow-up."))).toBe(
      "Scheduled result — Morning sales review\n\n> Three leads need follow-up.\n\n"
    );
  });

  test("long results are bounded plain text", () => {
    const formatted = formatCronResultContext(job("Overflow"), run("x".repeat(5000)));
    expect(formatted.startsWith("Scheduled result — Overflow\n\n> ")).toBe(true);
    expect(formatted.length).toBeLessThan(2200);
    expect(formatted).toContain("…");
    expect(formatted).not.toMatch(/[\u0000-\u0008]/);
  });
});
