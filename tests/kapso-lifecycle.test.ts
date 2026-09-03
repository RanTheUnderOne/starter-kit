import { describe, expect, test } from "vitest";
import { kapsoDeletedPatch } from "../src/lib/kapso-lifecycle";

describe("Kapso lifecycle", () => {
  test("Kapso deletion clears every stale provider field", () => {
    expect(kapsoDeletedPatch()).toMatchObject({
      status: "revoked",
      enabled: false,
      phone_number_id: null,
      business_account_id: null,
      display_phone_number: null,
      connected_at: null,
    });
  });
});
