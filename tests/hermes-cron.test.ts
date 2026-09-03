import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  cronJobId,
  cronJobInput,
  encodeHermesCronExec,
  normalizeCronJob,
} from "../src/lib/hermes-cron-core";

const hermesCron = readFileSync(resolve(import.meta.dirname, "../src/lib/hermes-cron.ts"), "utf8");

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

  test("lists jobs from Hermes files instead of importing the cron package", () => {
    expect(hermesCron).not.toContain("from cron.jobs");
    expect(hermesCron).not.toContain("from cron.executions");
    expect(hermesCron).toContain("jobs.json");
    expect(hermesCron).toContain("executions.db");
  });
});
