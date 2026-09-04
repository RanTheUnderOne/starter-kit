import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  cronJobId,
  cronJobInput,
  encodeHermesCronExec,
  normalizeCronJob,
} from "../src/lib/hermes-cron-core";

const root = resolve(import.meta.dirname, "..");

describe("Hermes cron command safety", () => {
  test("encodes every browser-controlled argument instead of interpolating shell text", () => {
    const hostilePrompt = "hello'; rm -rf /";
    const command = encodeHermesCronExec([
      "create",
      "0 8 * * *",
      hostilePrompt,
      "--name",
      "Sales $(whoami)",
    ]);

    expect(command).not.toContain(hostilePrompt);
    expect(command).not.toContain("$(whoami)");
    expect(command).toContain("base64");
    expect(command).toContain("subprocess.run");
  });

  test("rejects invalid job identifiers", () => {
    expect(() => cronJobId.parse("../jobs.json")).toThrow();
    expect(() => cronJobId.parse("job with spaces")).toThrow();
    expect(cronJobId.parse("job_123-abc")).toBe("job_123-abc");
  });

  test("executes python snippet for listJobsCommand cleanly without private cron imports", () => {
    const cronSource = readFileSync(resolve(root, "src/lib/hermes-cron.ts"), "utf8");
    const listJobsCommandMatch = cronSource.match(/const LIST_JOBS_COMMAND = `([\s\S]*?)`;/);
    expect(listJobsCommandMatch).not.toBeNull();
    const command = listJobsCommandMatch![1];

    expect(command).not.toContain("from cron.jobs");

    const result = spawnSync("sh", ["-c", command], {
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("ModuleNotFoundError");
    expect(() => JSON.parse(result.stdout)).not.toThrow();
  });

  test("executes python snippet for listRunsCommand cleanly without private cron imports", () => {
    const cronSource = readFileSync(resolve(root, "src/lib/hermes-cron.ts"), "utf8");
    const listRunsMatch = cronSource.match(/function listRunsCommand[\s\S]*?return `([\s\S]*?)`;/);
    expect(listRunsMatch).not.toBeNull();
    const commandTemplate = listRunsMatch![1];
    const encodedJobId = Buffer.from("test_job", "utf8").toString("base64");
    const command = commandTemplate
      .replace(/\${encodedJobId}/g, encodedJobId)
      .replace(/\${Math\.min\(Math\.max\(limit, 1\), 50\)}/g, "20");

    expect(command).not.toContain("from cron.executions");
    expect(command).not.toContain("from hermes_constants");

    const result = spawnSync("sh", ["-c", command], {
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("ModuleNotFoundError");
  });
});

describe("Hermes cron public contract", () => {
  test("validates supported schedules and browser-controlled sizes", () => {
    expect(
      cronJobInput.parse({
        name: "Morning review",
        schedule: "0 8 * * 0-4",
        prompt: "Review today's leads.",
      }),
    ).toMatchObject({ schedule: "0 8 * * 0-4" });

    expect(
      cronJobInput.safeParse({ name: "x", schedule: "bad", prompt: "hello" }).success,
    ).toBe(false);
    expect(
      cronJobInput.safeParse({
        name: "x",
        schedule: "0 8 * * *",
        prompt: "x".repeat(20_001),
      }).success,
    ).toBe(false);
  });

  test("normalizes Hermes job data without exposing internal fields", () => {
    expect(
      normalizeCronJob({
        id: "job_123",
        name: "alfi:morning-sales-review",
        display_name: "Morning sales review",
        prompt: "Review leads",
        schedule: "0 8 * * 0-4",
        enabled: true,
        next_run_at: "2026-09-04T05:00:00Z",
        last_run_at: null,
        last_status: "completed",
        last_error: null,
        skills: ["business/morning-review"],
        internal_secret: "must not escape",
      }),
    ).toEqual({
      id: "job_123",
      name: "alfi:morning-sales-review",
      displayName: "Morning sales review",
      prompt: "Review leads",
      schedule: "0 8 * * 0-4",
      state: "scheduled",
      enabled: true,
      nextRunAt: "2026-09-04T05:00:00Z",
      lastRunAt: null,
      lastStatus: "completed",
      lastError: null,
      skills: ["business/morning-review"],
      managedDefault: true,
    });
  });
});
