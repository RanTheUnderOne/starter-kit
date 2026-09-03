import { describe, expect, test } from "vitest";
import { isStaffUser } from "../src/lib/staff";

const user = (value: { app_metadata?: Record<string, unknown>; email?: string | null }) => value;

describe("staff authorization", () => {
  test("verified app metadata grants staff access", () => {
    expect(isStaffUser(user({ app_metadata: { alfi_role: "staff" } }), "")).toBe(true);
  });

  test("workspace admin membership alone does not grant staff access", () => {
    expect(isStaffUser(user({ app_metadata: {} }), "")).toBe(false);
  });

  test("product staff allowlist grants ran547830@gmail.com", () => {
    expect(isStaffUser(user({ email: "Ran547830@gmail.com" }), "")).toBe(true);
  });

  test("server allowlist matching is exact and case insensitive", () => {
    const allowlist = "ops@alfi.ai, support@alfi.ai";
    expect(isStaffUser(user({ email: "OPS@ALFI.AI" }), allowlist)).toBe(true);
    expect(isStaffUser(user({ email: "ops@alfi.ai.attacker.test" }), allowlist)).toBe(false);
  });
});
