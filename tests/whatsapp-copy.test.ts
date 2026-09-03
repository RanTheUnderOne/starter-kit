import { describe, expect, test } from "vitest";
import { messages } from "../src/lib/i18n";

describe("WhatsApp customer copy", () => {
  test("customer copy distinguishes the public business inbox from the private owner channel", () => {
    expect(messages.en.whatsappBusinessTitle).toBe("Connect your business WhatsApp");
    expect(messages.en.whatsappOwnerTitle).toBe("Talk to Alfi on WhatsApp");
  });
});
