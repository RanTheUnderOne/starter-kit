import { describe, expect, test } from "vitest";
import { createAgentWithProvisionFailure } from "../src/lib/kapso-lifecycle";

describe("agent creation", () => {
  test("does not report 201 when Alfi provisioning fails", async () => {
    expect((await createAgentWithProvisionFailure()).status).toBeGreaterThanOrEqual(500);
  });
});
