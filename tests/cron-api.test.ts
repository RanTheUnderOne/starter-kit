import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { cronActionInput, cronJobInput } from "../src/lib/hermes-cron-core";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("customer cron API", () => {
  test("rejects invalid schedules, oversized prompts, and unknown actions", () => {
    expect(cronJobInput.safeParse({ name: "x", schedule: "bad", prompt: "hello" }).success).toBe(false);
    expect(
      cronJobInput.safeParse({ name: "x", schedule: "0 8 * * *", prompt: "x".repeat(20_001) }).success,
    ).toBe(false);
    expect(cronActionInput.safeParse({ action: "restart" }).success).toBe(false);
  });

  test("requires membership for reads and admin access for mutations", () => {
    const collection = read("src/app/api/agents/[id]/cron/route.ts");
    const item = read("src/app/api/agents/[id]/cron/[jobId]/route.ts");
    const action = read("src/app/api/agents/[id]/cron/[jobId]/action/route.ts");
    const runs = read("src/app/api/agents/[id]/cron/[jobId]/runs/route.ts");

    expect(collection).toContain('requireAgentAccess(id, "member")');
    expect(collection).toContain('requireAgentAccess(id, "admin")');
    expect(item).toContain('requireAgentAccess(id, "admin")');
    expect(action).toContain('requireAgentAccess(id, "admin")');
    expect(runs).toContain('requireAgentAccess(id, "member")');
  });

  test("validates every browser-controlled body and job id", () => {
    const routes = [
      read("src/app/api/agents/[id]/cron/route.ts"),
      read("src/app/api/agents/[id]/cron/[jobId]/route.ts"),
      read("src/app/api/agents/[id]/cron/[jobId]/action/route.ts"),
      read("src/app/api/agents/[id]/cron/[jobId]/runs/route.ts"),
    ].join("\n");

    expect(routes).toContain("cronJobInput.parse");
    expect(routes.match(/cronJobId\.parse/g)?.length).toBeGreaterThanOrEqual(3);
    expect(routes).toContain("cronActionInput.parse");
  });
});
