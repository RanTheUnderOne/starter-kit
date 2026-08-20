# Alphi Mobile Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the complete authenticated Alphi dashboard into a responsive phone experience while preserving desktop behavior and application logic.

**Architecture:** Keep one responsive React tree per shell. Permanent rails become translated fixed drawers below `md` and remain static rails above `md`; phone-only headers and tab navigation expose the same routes/actions. Dense tables gain card renderings below their desktop breakpoint.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Lucide icons.

## Global Constraints

- Preserve all English copy and LTR layout.
- Preserve routes, authentication, Supabase, Agent37 API behavior, and state retention.
- Preserve the existing desktop layout at `md` and above.
- Do not modify or stage `package-lock.json`.
- Do not perform visual/browser testing; verify with static guards, TypeScript, and production build.

---

### Task 1: Responsive application shells

**Files:**
- Create: `scripts/verify-mobile.mjs`
- Modify: `src/components/DashboardShell.tsx`
- Modify: `src/components/AgentWorkspace.tsx`

**Interfaces:**
- Consumes: existing `NAV`, `TABS`, pathname routing, workspace/account components, chat provider state.
- Produces: phone headers and accessible slide-in navigation using `md:hidden`, `hidden md:flex`, transform state, and overlay controls.

- [ ] Create `verify-mobile.mjs` that asserts both shells contain a mobile header, drawer trigger, responsive rail classes, and mobile workspace tabs.
- [ ] Run `node scripts/verify-mobile.mjs`; expect failure because those markers do not exist.
- [ ] Add `useState` drawer state, `Menu`/`X` controls, backdrop, translated rails, and `md` desktop restoration to both shells.
- [ ] Add phone workspace tabs that call the existing `selectTab` function and retain mounted chat/files behavior.
- [ ] Run the guard and `npm run typecheck`; expect success.

### Task 2: Responsive fleet and workspace content

**Files:**
- Modify: `scripts/verify-mobile.mjs`
- Modify: `src/components/AgentsView.tsx`
- Modify: `src/components/MembersView.tsx`
- Modify: `src/components/SettingsView.tsx`
- Modify: `src/components/files/FilesView.tsx`
- Modify: `src/components/chat/ChatView.tsx`
- Modify: `src/components/chat/ChatMessages.tsx`
- Modify: `src/components/AgentSettingsTab.tsx`

**Interfaces:**
- Consumes: existing agent/member/file records and current action handlers.
- Produces: phone card renderings and responsive spacing without changing business logic.

- [ ] Extend the guard to require phone cards and responsive rows/grids; run it and confirm the expected failure.
- [ ] Add `md:hidden` phone cards and `hidden md:block` desktop tables for Agents and Files, plus `sm` card/table variants for Members.
- [ ] Stack header/actions and settings controls on phones; collapse settings numeric grids to one column.
- [ ] Reduce chat and content padding below `sm` while preserving desktop values.
- [ ] Run the mobile and brand guards, typecheck, build, and `git diff --check`; expect success.

### Task 3: Commit and deploy

**Files:**
- Commit only the spec, plan, verifier, and responsive source files.

**Interfaces:**
- Consumes: verified commit on `feat/alphi-branding`.
- Produces: Vercel production deployment from the exact Git SHA.

- [ ] Confirm `package-lock.json` is unstaged and excluded.
- [ ] Commit with `feat: make alphi dashboard mobile responsive`.
- [ ] Push `feat/alphi-branding` to `RanTheUnderOne/starter-kit`.
- [ ] Wait for its automatic Vercel preview to reach READY.
- [ ] Promote that exact deployment to production and confirm READY/PROMOTED.
