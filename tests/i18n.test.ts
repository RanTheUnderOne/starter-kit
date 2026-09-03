import { describe, expect, test } from "vitest";
import { localeDirection, messages, translate } from "../src/lib/i18n";

describe("Alfi localization", () => {
  test("Hebrew selects RTL and English selects LTR", () => {
    expect(localeDirection("he")).toBe("rtl");
    expect(localeDirection("en")).toBe("ltr");
  });

  test("every customer translation key exists in both languages", () => {
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.he).sort());
  });

  test("unknown locales and keys fall back safely", () => {
    expect(localeDirection("fr")).toBe("ltr");
    expect(translate("he", "nav.chat")).toBe("אלפי");
  });
});
