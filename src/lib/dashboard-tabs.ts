export const customerTabs = [
  { id: "chat", labelKey: "nav.chat" },
  { id: "schedules", labelKey: "nav.schedules" },
  { id: "whatsapp", labelKey: "nav.whatsapp" },
  { id: "business", labelKey: "nav.business" },
] as const;

export const staffTabs = [{ id: "advanced", labelKey: "nav.advanced" }] as const;

export type CustomerAgentTab = (typeof customerTabs)[number]["id"];
export type StaffAgentTab = (typeof staffTabs)[number]["id"];
export type AgentTab = CustomerAgentTab | StaffAgentTab;

export function tabsFor(isStaff: boolean) {
  return isStaff ? [...customerTabs, ...staffTabs] : [...customerTabs];
}

export function agentTabPath(agentId: string, tab: AgentTab): string {
  return `/dashboard/agents/${agentId}/${tab}`;
}

export function parseAgentTab(segments?: string[], isStaff = false): AgentTab | null {
  if (!segments || segments.length === 0) return "chat";
  if (segments.length !== 1) return null;
  const value = segments[0];
  return tabsFor(isStaff).some((tab) => tab.id === value) ? (value as AgentTab) : null;
}

export function shouldEnterAgentDirectly(isStaff: boolean, agentCount: number) {
  return !isStaff && agentCount === 1;
}
