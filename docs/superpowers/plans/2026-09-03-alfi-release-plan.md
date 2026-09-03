# Alfi Consolidation and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the canonical Alfi repository, verify the complete production flow, and publish a working customer URL.

**Architecture:** `starter-kit` becomes the canonical product repository. The legacy Wassenger project is not copied; only provider-neutral knowledge that is absent from Alfi may be ported. Release gates cover code, tenant boundaries, runtime provisioning, both WhatsApp paths, cron jobs/results, localization, responsive browser behavior, and deployment configuration.

**Tech Stack:** Git, Next.js, Vitest, Vercel, Supabase, Agent37, Kapso, Meta Cloud WhatsApp.

## Global Constraints

- No claim of completion without fresh verification evidence.
- No secrets are printed, committed, or returned to the browser.
- No Wassenger runtime enters the canonical repository.
- Deployment is complete only when the final URL is opened and verified.
- Missing production credentials are reported as an external blocker, never silently bypassed.

---

### Task 1: Consolidate product identity and operations documentation

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `.env.example`
- Create: `docs/operations/production.md`
- Create: `tests/product-boundary.test.ts`

**Interfaces:**
- Produces: package identity `alfi-business-agent`
- Produces: one production checklist covering Supabase, Agent37, Kapso, Meta, and Vercel

- [ ] **Step 1: Write failing boundary test**

```ts
test("canonical product contains only the two approved WhatsApp tracks", () => {
  expect(repositoryText()).not.toMatch(/wassenger/i);
  expect(repositoryText()).toMatch(/Kapso/);
  expect(repositoryText()).toMatch(/Meta Cloud/);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/product-boundary.test.ts`  
Expected: FAIL because repository identity and documentation still describe an Agent37 starter kit.

- [ ] **Step 3: Rewrite product and operations documentation**

Document exact environment-variable names, migration order, Meta callback URL, Kapso webhook configuration, staff-role configuration, cron provisioning checks, Vercel deployment steps, rollback, and secret-handling rules. Do not copy the legacy Wassenger server or skills.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/product-boundary.test.ts`  
Expected: PASS with no production Wassenger path.

- [ ] **Step 5: Commit**

```bash
git add package.json README.md .env.example docs/operations tests/product-boundary.test.ts
git commit -m "docs: establish canonical Alfi product"
```

### Task 2: Full automated verification

**Files:**
- Modify: affected tests from all implementation plans
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run verify` executing generation check, tests, typecheck, and build

- [ ] **Step 1: Add the release verification script**

```json
{
  "scripts": {
    "verify": "npm run generate:alfi && npm test && npm run typecheck && npm run build"
  }
}
```

- [ ] **Step 2: Run focused tests**

Run: `npm test`  
Expected: every unit and route integration test PASS.

- [ ] **Step 3: Run production verification**

Run: `npm run verify`  
Expected: deterministic generation, all tests, TypeScript, and Next.js production build PASS with exit code 0.

- [ ] **Step 4: Confirm clean generated state**

Run: `git status --short`  
Expected: only intentional source/test/documentation changes remain; a second build creates no generated-file drift.

- [ ] **Step 5: Commit**

```bash
git add package.json tests src agent scripts docs
git commit -m "test: add Alfi production release gate"
```

### Task 3: Browser and runtime verification

**Files:**
- Create: `docs/operations/release-evidence.md`

**Interfaces:**
- Produces: evidence for English desktop, Hebrew RTL mobile, cron results-to-chat, WhatsApp setup, staff boundary, and deployed health

- [ ] **Step 1: Start the verified production build locally**

Run: `npm run start` after `npm run build`  
Expected: server starts successfully and `/login` returns 200.

- [ ] **Step 2: Exercise customer browser flows**

Verify login rendering, language switching, document direction, responsive navigation, chat, schedules CRUD, results-to-chat prefill, business page, both WhatsApp cards, keyboard focus, and empty/error/loading states.

- [ ] **Step 3: Exercise staff and authorization boundaries**

Verify customer requests to files, models, budgets, lifecycle, and diagnostics receive 403; a configured staff account can use Advanced; cross-workspace agent IDs return 404.

- [ ] **Step 4: Exercise a real Agent37 provision when credentials are available**

Create or use a designated test Alfi, confirm SOUL and skills exist, list the two default jobs, run cron doctor/status, trigger a safe local-delivery job, read its result, and continue it in chat. Remove only the designated test instance when cleanup is explicitly authorized.

- [ ] **Step 5: Record evidence**

Record timestamps, URLs, HTTP statuses, non-secret identifiers, test counts, build result, and any external configuration that could not be exercised.

- [ ] **Step 6: Commit**

```bash
git add docs/operations/release-evidence.md
git commit -m "docs: record Alfi release verification"
```

### Task 4: Push, deploy, and verify the public URL

**Files:**
- No source files unless deployment verification reveals a regression.

**Interfaces:**
- Produces: updated PR branch and a verified Vercel URL

- [ ] **Step 1: Inspect final branch state**

Run: `git status --short` and `git log --oneline --decorate -10`  
Expected: clean worktree and focused commits on `cursor/alfi-whatsapp-provisioning-b3a3`.

- [ ] **Step 2: Push the PR branch**

Run: `git push origin cursor/alfi-whatsapp-provisioning-b3a3`  
Expected: remote branch advances successfully.

- [ ] **Step 3: Wait for Vercel and inspect deployment checks**

Expected: Vercel deployment succeeds for the pushed commit. If preview protection blocks anonymous access, verify with the authenticated project surface and do not call it public.

- [ ] **Step 4: Merge only after all required checks pass**

Merge PR #3 into `main` using an authenticated GitHub path, then verify Vercel's production deployment corresponds to that merge commit.

- [ ] **Step 5: Open the production URL and verify**

Expected: production URL loads, redirects unauthenticated users to the Alfi login, and authenticated customer/staff smoke flows match Task 3.

- [ ] **Step 6: Report the final URL and evidence**

Return the exact verified URL, deployed commit, test/build results, exercised integrations, and any remaining external credential/configuration blockers.

