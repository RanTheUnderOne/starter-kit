import { describe, expect, test } from "vitest";
import { alfiWhatsAppTalkUrl, configuredAlfiWhatsAppDigits, digitsFromDisplay } from "../src/lib/alfi-whatsapp-link";

describe("Alfi WhatsApp talk link", () => {
  test("strips formatting from a display number", () => {
    expect(digitsFromDisplay("+972 50-123-4567")).toBe("972501234567");
  });

  test("builds a wa.me link from digits", () => {
    expect(alfiWhatsAppTalkUrl("+972 50-123-4567", "Hi Alfi")).toBe(
      "https://wa.me/972501234567?text=Hi%20Alfi",
    );
  });

  test("returns null when no number is configured", () => {
    expect(alfiWhatsAppTalkUrl("", "Hi Alfi")).toBeNull();
    expect(configuredAlfiWhatsAppDigits("", "")).toBe("");
  });

  test("uses the branded Alfi number", () => {
    expect(configuredAlfiWhatsAppDigits()).toBe("15554470260");
    expect(alfiWhatsAppTalkUrl(configuredAlfiWhatsAppDigits(), "Hi Alfi")).toBe(
      "https://wa.me/15554470260?text=Hi%20Alfi",
    );
  });

  test("prefers the branded number over env", () => {
    expect(configuredAlfiWhatsAppDigits("15551212", "972501234567")).toBe("972501234567");
  });
});
