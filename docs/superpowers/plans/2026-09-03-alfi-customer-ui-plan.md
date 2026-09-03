# Alfi Customer UI and Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the technical dashboard with the approved bilingual Living Assistant experience while preserving a server-protected staff Advanced area.

**Architecture:** A small locale provider owns English/Hebrew dictionaries and document direction. The agent workspace exposes customer tabs for Alfi, Schedules, WhatsApp, and Business; staff receive Advanced. Existing technical components are reused only behind staff authorization.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Lucide, Vitest.

## Global Constraints

- Direction B — Living Assistant is the approved visual direction.
- English uses LTR and Hebrew uses RTL at document level.
- Customer UI contains no model, budget, resource, port, raw ID, restart, delete, or diagnostic controls.
- Technical routes and UI require server-confirmed staff status.
- Customer errors are concise; technical detail remains staff-only.

---

### Task 1: Locale and direction foundation

**Files:**
- Create: `src/lib/i18n.ts`
- Create: `src/components/LocaleProvider.tsx`
- Create: `src/components/LanguageToggle.tsx`
- Create: `tests/i18n.test.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `Locale = "en" | "he"`
- Produces: `useLocale(): { locale, dir, t, setLocale }`
- Produces: cookie key `alfi_locale`

- [ ] **Step 1: Write failing locale tests**

```ts
test("Hebrew selects RTL and English selects LTR", () => {
  expect(localeDirection("he")).toBe("rtl");
  expect(localeDirection("en")).toBe("ltr");
});

test("every customer translation key exists in both languages", () => {
  expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.he).sort());
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/i18n.test.ts`  
Expected: FAIL because locale modules do not exist.

- [ ] **Step 3: Implement provider and premium theme**

Read the initial cookie in the root layout, set `<html lang dir>`, update both attributes and the cookie on language switch, and define deep-teal/mint/cream/amber design tokens. Use logical CSS properties so layouts mirror naturally.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/i18n.test.ts`  
Expected: PASS for dictionary parity, fallback behavior, and direction.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n.ts src/components/LocaleProvider.tsx src/components/LanguageToggle.tsx src/app/layout.tsx src/app/globals.css tests/i18n.test.ts
git commit -m "feat: add bilingual Alfi design foundation"
```

### Task 2: Staff authorization boundary

**Files:**
- Create: `src/lib/staff.ts`
- Create: `tests/staff-auth.test.ts`
- Modify: `src/lib/auth.ts`
- Modify: `src/components/WorkspaceProvider.tsx`
- Modify: `src/app/dashboard/layout.tsx`
- Modify: technical routes under `src/app/api/agents/[id]/files`, `budget`, `usage`, `resize`, `signed-url`, `provision`, and `[action]`

**Interfaces:**
- Produces: `isStaffUser(user): boolean`
- Produces: `requireStaff(): Promise<{ db, user }>`
- Produces: `requireStaffAgentAccess(agentId)`
- Produces: `useWorkspace().isStaff`

- [ ] **Step 1: Write failing staff tests**

```ts
test("verified app metadata grants staff access", () => {
  expect(isStaffUser(user({ app_metadata: { alfi_role: "staff" } }))).toBe(true);
});

test("workspace admin membership alone does not grant staff access", () => {
  expect(isStaffUser(user({ app_metadata: {} }))).toBe(false);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/staff-auth.test.ts`  
Expected: FAIL because staff authorization does not exist.

- [ ] **Step 3: Implement and apply staff checks**

Accept only verified Supabase `app_metadata.alfi_role === "staff"` or an exact normalized email in server-only `ALFI_STAFF_EMAILS`. Gate every technical read and mutation server-side; leave chat, customer cron, business integrations, and WhatsApp customer routes tenant-scoped.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/staff-auth.test.ts`  
Expected: PASS for staff, customer, missing session, and cross-agent access.

- [ ] **Step 5: Commit**

```bash
git add src/lib/staff.ts src/lib/auth.ts src/components/WorkspaceProvider.tsx src/app/dashboard/layout.tsx src/app/api/agents tests/staff-auth.test.ts
git commit -m "feat: enforce staff-only technical access"
```

### Task 3: Customer workspace and schedule experience

**Files:**
- Create: `src/components/SchedulesTab.tsx`
- Create: `src/components/ScheduleEditor.tsx`
- Create: `src/components/AdvancedTab.tsx`
- Create: `tests/dashboard-tabs.test.ts`
- Modify: `src/lib/dashboard-tabs.ts`
- Modify: `src/components/AgentWorkspace.tsx`
- Modify: `src/components/DashboardShell.tsx`
- Modify: `src/components/AgentsView.tsx`
- Modify: `src/app/dashboard/(fleet)/page.tsx`

**Interfaces:**
- Customer tabs: `chat | schedules | whatsapp | business`
- Staff-only tab: `advanced`
- `SchedulesTab` consumes the cron BFF from the bundle/cron plan

- [ ] **Step 1: Write failing navigation tests**

```ts
test("customer tabs contain only product destinations", () => {
  expect(customerTabs.map((tab) => tab.id)).toEqual(["chat", "schedules", "whatsapp", "business"]);
});

test("advanced is absent for customers and present for staff", () => {
  expect(tabsFor(false).some((tab) => tab.id === "advanced")).toBe(false);
  expect(tabsFor(true).some((tab) => tab.id === "advanced")).toBe(true);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/dashboard-tabs.test.ts`  
Expected: FAIL because the current tabs are Chat, Files, Integrations, and Settings.

- [ ] **Step 3: Implement the Living Assistant shell**

Use a responsive top/side navigation, prominent Alfi conversation, accessible mobile navigation, bilingual labels, customer-friendly states, and a staff-only Advanced entry. Non-staff customers with one agent enter it directly; staff retain the fleet.

- [ ] **Step 4: Implement schedules UI**

Show friendly job cards with next run, last state, pause/resume/run/edit/delete controls, a create dialog, and recent result cards. Hide raw cron syntax behind the editor's human schedule choices while preserving an Advanced schedule option only when safely validated.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- tests/dashboard-tabs.test.ts` and `npm run typecheck`  
Expected: PASS with no customer path rendering technical navigation.

- [ ] **Step 6: Commit**

```bash
git add src/components src/lib/dashboard-tabs.ts src/app/dashboard tests/dashboard-tabs.test.ts
git commit -m "feat: build Alfi customer workspace"
```

### Task 4: Continue a cron result in Alfi chat

**Files:**
- Create: `tests/cron-result-context.test.ts`
- Modify: `src/components/chat/ChatProvider.tsx`
- Modify: `src/components/chat/ChatView.tsx`
- Modify: `src/components/chat/ChatComposer.tsx`
- Modify: `src/components/SchedulesTab.tsx`

**Interfaces:**
- Produces: `prefillComposer(context: string): void`
- Produces: `formatCronResultContext(job, run): string`

- [ ] **Step 1: Write failing context-format test**

```ts
test("cron result context identifies the job and preserves the result", () => {
  expect(formatCronResultContext(job("Morning sales review"), run("Three leads need follow-up."))).toBe(
    "Scheduled result — Morning sales review\n\n> Three leads need follow-up.\n\n"
  );
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/cron-result-context.test.ts`  
Expected: FAIL because prefill support does not exist.

- [ ] **Step 3: Add one-shot composer prefill**

Store the draft in `ChatProvider`, switch to the existing chat tab, merge it into any unsent text without auto-sending, focus the composer on desktop, and clear the pending prefill only after it is consumed.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/cron-result-context.test.ts` and `npm run typecheck`  
Expected: PASS; the generated context is bounded and plain text.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat src/components/SchedulesTab.tsx tests/cron-result-context.test.ts
git commit -m "feat: continue scheduled results in chat"
```

