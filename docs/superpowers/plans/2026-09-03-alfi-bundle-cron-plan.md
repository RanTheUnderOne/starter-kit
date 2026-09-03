# Alfi Bundle and Cron Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic global Alfi bundle that installs default Hermes cron jobs and exposes each customer's live cron jobs and results safely.

**Architecture:** A repository-owned JSON manifest defines new-agent cron defaults. The build validates and embeds SOUL, configuration, skills, and cron defaults; provisioning uploads the bundle and uses fixed server-generated Hermes CLI commands through Agent37 exec. Customer routes read and mutate only the live Hermes cron store for their authorized agent.

**Tech Stack:** Next.js 16 App Router, TypeScript, Node.js, Vitest, Agent37 exec, Hermes cron CLI.

## Global Constraints

- V1 timezone is exactly `Asia/Jerusalem`.
- Repository defaults are global product source; customer edits affect only their live agent.
- Browser input never becomes raw shell text.
- Default jobs are installed through supported Hermes cron commands, never by overwriting `jobs.json`.
- A new approval engine and activity ledger are out of scope.

---

### Task 1: Deterministic bundle and cron manifest

**Files:**
- Create: `agent/alfi-structure/cron/jobs.json`
- Create: `tests/alfi-bundle.test.ts`
- Modify: `scripts/generate-alfi-bundle.mjs`
- Modify: `src/generated/alfi-bundle.ts`
- Modify: `agent/alfi-structure/cron/README.md`

**Interfaces:**
- Produces: `ALFI_BUNDLE: readonly { path: string; base64: string }[]`
- Produces: `ALFI_DEFAULT_CRON_JOBS: readonly AlfiDefaultCronJob[]`
- Produces: stable job keys `alfi:morning-sales-review` and `alfi:evening-pipeline-audit`

- [ ] **Step 1: Write failing generator tests**

```ts
test("bundle includes SOUL, config, skills, and cron defaults", async () => {
  expect(ALFI_BUNDLE.map((file) => file.path)).toContain("SOUL.md");
  expect(ALFI_BUNDLE.map((file) => file.path)).toContain("config/mcp.yaml");
  expect(ALFI_DEFAULT_CRON_JOBS.map((job) => job.key)).toEqual([
    "alfi:evening-pipeline-audit",
    "alfi:morning-sales-review",
  ]);
});

test("every default cron skill exists in the generated bundle", () => {
  const installed = new Set(ALFI_BUNDLE.map((file) => file.path));
  for (const job of ALFI_DEFAULT_CRON_JOBS) {
    for (const skill of job.skills) expect(installed.has(`skills/${skill}/SKILL.md`)).toBe(true);
  }
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/alfi-bundle.test.ts`  
Expected: FAIL because `ALFI_DEFAULT_CRON_JOBS` and the manifest do not exist and config is excluded.

- [ ] **Step 3: Add and validate the manifest**

```json
[
  {
    "key": "alfi:morning-sales-review",
    "name": "Morning sales review",
    "schedule": "0 8 * * 0-4",
    "timezone": "Asia/Jerusalem",
    "skills": ["business/morning-review", "business/lead-triage", "sources/whatsapp", "sources/gmail", "crm/fireberry"],
    "deliver": "local",
    "prompt": "Review new inbound leads from WhatsApp and Gmail, deduplicate them through the configured CRM, prioritize urgent or unanswered opportunities, and produce a concise owner briefing with proposed next steps. Do not contact customers or mutate CRM records."
  },
  {
    "key": "alfi:evening-pipeline-audit",
    "name": "Evening pipeline review",
    "schedule": "0 18 * * 0-4",
    "timezone": "Asia/Jerusalem",
    "skills": ["business/lead-triage", "business/follow-up-radar"],
    "deliver": "local",
    "prompt": "Review today's lead pipeline, identify conversations waiting for the business, summarize important changes, and propose the next follow-up actions. Do not contact customers or mutate CRM records."
  }
]
```

- [ ] **Step 4: Make generation deterministic**

Sort normalized repository-relative paths, normalize text to LF before base64 encoding, include `SOUL.md`, `config/`, and `skills/`, validate the manifest schema and referenced skill paths, and emit both exports.

- [ ] **Step 5: Verify GREEN and clean regeneration**

Run: `npm run generate:alfi` twice, then `npm test -- tests/alfi-bundle.test.ts`, then `git diff --exit-code src/generated/alfi-bundle.ts` after the second generation.  
Expected: generator reports the same file count twice, tests PASS, and the second generation produces no diff.

- [ ] **Step 6: Commit**

```bash
git add agent/alfi-structure/cron scripts/generate-alfi-bundle.mjs src/generated/alfi-bundle.ts tests/alfi-bundle.test.ts
git commit -m "feat: bundle Alfi cron defaults"
```

### Task 2: Safe Hermes cron execution adapter

**Files:**
- Create: `src/lib/hermes-cron.ts`
- Create: `tests/hermes-cron.test.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `listCronJobs(agentId: string): Promise<CronJob[]>`
- Produces: `listCronRuns(agentId: string, jobId: string, limit?: number): Promise<CronRun[]>`
- Produces: `createCronJob`, `updateCronJob`, `pauseCronJob`, `resumeCronJob`, `runCronJob`, `removeCronJob`
- Produces: `encodeHermesCronExec(args: readonly string[]): string`

- [ ] **Step 1: Write failing command-safety tests**

```ts
test("encodes every browser-controlled argument instead of interpolating shell text", () => {
  const command = encodeHermesCronExec(["create", "0 8 * * *", "hello'; rm -rf /", "--name", "Sales"]);
  expect(command).not.toContain("hello'; rm -rf /");
  expect(command).toContain("base64");
});

test("rejects invalid job identifiers", () => {
  expect(() => cronJobId.parse("../jobs.json")).toThrow();
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/hermes-cron.test.ts`  
Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement safe exec and normalized public types**

Use a fixed remote Python wrapper that base64-decodes a JSON string array and invokes `subprocess.run(["hermes", "cron", ...args], check=False, capture_output=True, text=True)`. Read-only list/history scripts import Hermes' installed `cron.jobs.list_jobs` and `cron.executions.list_executions`, serialize only allowlisted fields, and cap output content and result count.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/hermes-cron.test.ts`  
Expected: PASS, including hostile prompt/name inputs and normalized job state.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hermes-cron.ts src/lib/types.ts tests/hermes-cron.test.ts
git commit -m "feat: add safe Hermes cron adapter"
```

### Task 3: Provision default jobs with every new Alfi

**Files:**
- Create: `tests/alfi-provisioning.test.ts`
- Modify: `src/lib/alfi-provisioning.ts`
- Modify: `src/app/api/agents/route.ts`
- Modify: `src/app/api/agents/[id]/provision/route.ts`

**Interfaces:**
- Consumes: `ALFI_DEFAULT_CRON_JOBS`
- Consumes: safe cron adapter from Task 2
- Produces: `installDefaultCronJobs(agentId, defaults)` that creates only missing namespaced defaults

- [ ] **Step 1: Write failing provisioning tests**

```ts
test("provisioning installs every missing default before reporting ready", async () => {
  const result = await buildProvisioningSteps(existingJobs([]));
  expect(result.map((step) => step.kind)).toEqual([
    "upload-bundle", "configure", "verify-skills", "install-crons", "verify-crons", "cron-doctor", "health"
  ]);
});

test("re-provisioning does not overwrite a customer's edited live job", async () => {
  const steps = await buildCronInstallSteps(existingJobs([{ name: "alfi:morning-sales-review", schedule: "0 9 * * *" }]));
  expect(steps).toHaveLength(1);
  expect(steps[0].name).toBe("alfi:evening-pipeline-audit");
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/alfi-provisioning.test.ts`  
Expected: FAIL because provisioning has no cron phase.

- [ ] **Step 3: Implement complete provisioning**

Upload the generated bundle, write configuration with mode `0600`, set `TZ=Asia/Jerusalem`, validate skills, create missing defaults with attached skills and `deliver=local`, run list/doctor/status checks, restart when configuration changed, and mark ready only after final health succeeds. Return a non-2xx response when synchronous creation provisioning fails.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/alfi-provisioning.test.ts`  
Expected: PASS for first install, retry, missing skill, cron doctor failure, and health failure.

- [ ] **Step 5: Commit**

```bash
git add src/lib/alfi-provisioning.ts src/app/api/agents/route.ts src/app/api/agents/[id]/provision/route.ts tests/alfi-provisioning.test.ts
git commit -m "feat: install cron jobs during Alfi provisioning"
```

### Task 4: Authenticated cron BFF routes

**Files:**
- Create: `src/app/api/agents/[id]/cron/route.ts`
- Create: `src/app/api/agents/[id]/cron/[jobId]/route.ts`
- Create: `src/app/api/agents/[id]/cron/[jobId]/action/route.ts`
- Create: `src/app/api/agents/[id]/cron/[jobId]/runs/route.ts`
- Create: `tests/cron-api.test.ts`

**Interfaces:**
- GET `/api/agents/:id/cron` returns `{ jobs: CronJob[] }`
- POST `/api/agents/:id/cron` accepts `{ name, schedule, prompt }`
- PATCH `/api/agents/:id/cron/:jobId` accepts `{ name, schedule, prompt }`
- DELETE `/api/agents/:id/cron/:jobId` removes one job
- POST `/api/agents/:id/cron/:jobId/action` accepts `{ action: "pause" | "resume" | "run" }`
- GET `/api/agents/:id/cron/:jobId/runs` returns `{ runs: CronRun[] }`

- [ ] **Step 1: Write failing validation and authorization tests**

```ts
test("cron routes reject a job belonging to another workspace", async () => {
  const response = await requestCronRoute({ signedInAs: "other-user", agentId: "agent-a" });
  expect(response.status).toBe(404);
});

test("cron creation rejects an invalid schedule and oversized prompt", async () => {
  expect(cronCreateInput.safeParse({ name: "x", schedule: "bad", prompt: "x".repeat(20001) }).success).toBe(false);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/cron-api.test.ts`  
Expected: FAIL because routes and schemas do not exist.

- [ ] **Step 3: Implement routes with structured allowlisted inputs**

Require agent membership for reads and workspace admin for mutations. Validate names, prompts, schedule expressions, job IDs, result limits, and action enums with Zod. Map Agent37/Hermes failures through the existing canonical API error shape.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/cron-api.test.ts`  
Expected: PASS for authorized CRUD, actions, result reads, invalid data, and cross-tenant access.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/agents/[id]/cron tests/cron-api.test.ts
git commit -m "feat: expose customer cron management APIs"
```

