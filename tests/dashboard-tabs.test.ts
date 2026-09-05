import { describe, expect, test } from "vitest";
import { customerTabs, parseAgentTab, shouldEnterAgentDirectly, tabsFor } from "../src/lib/dashboard-tabs";

describe("customer navigation", () => {
  test("contains only product destinations", () => {
    expect(customerTabs.map((tab) => tab.id)).toEqual(["chat", "schedules", "whatsapp", "business", "settings"]);
  });

  test("advanced is absent for customers and present for staff", () => {
    expect(tabsFor(false).some((tab) => tab.id === "advanced")).toBe(false);
    expect(tabsFor(true).some((tab) => tab.id === "advanced")).toBe(true);
  });

  test("server route parsing rejects staff tabs for customers", () => {
    expect(parseAgentTab(["advanced"], false)).toBeNull();
    expect(parseAgentTab(["advanced"], true)).toBe("advanced");
    expect(parseAgentTab(["settings"], false)).toBe("settings");
    expect(parseAgentTab(undefined, false)).toBe("chat");
  });

  test("non-staff customers with one Alfi enter it directly", () => {
    expect(shouldEnterAgentDirectly(false, 1)).toBe(true);
    expect(shouldEnterAgentDirectly(false, 2)).toBe(false);
    expect(shouldEnterAgentDirectly(true, 1)).toBe(false);
  });
});
