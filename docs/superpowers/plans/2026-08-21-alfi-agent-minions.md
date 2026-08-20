# Alfi Agent Minions Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a version-pinned Alfi Agent image containing Hermes, Minions, and a local task CLI, then add native responsive Tasks, Skills, and Schedules management to the existing Alphi dashboard for newly created Alfi Agent instances only.

**Architecture:** A separate `alfi-agent-image` build context extends the dated Agent37 Hermes image and starts Minions as an s6-supervised service on port `6969`. The Alphi Next.js BFF authenticates the user, verifies agent ownership and template capability, then calls the instance preview URL with `X-Agent37-Key`; the browser never receives Agent37 credentials or a Minions URL. A local `alfi tasks` CLI calls Minions over loopback, and a provisioned Hermes skill teaches the agent to use it from chat.

**Tech Stack:** Agent37 workspace templates, `ghcr.io/agent37-platform/hermes:2026.08.19c`, Minions `minionsai@0.1.27`, s6-overlay, Node.js CLI, Next.js 16 App Router, React 19, TypeScript, Supabase server authorization, Tailwind CSS, Node contract tests.

## Global Constraints

- The image/template name is `alfi-agent`; the first pinned application value is `alfi-agent@1`.
- Existing agents, templates, instances, tabs, and the current production deployment remain unchanged.
- Keep the inherited Hermes `ENTRYPOINT`; install binaries in `/usr/local` and image assets in `/opt`, never `/home/node` or `/home/linuxbrew`.
- Pin Hermes to `2026.08.19c` and Minions to `0.1.27`; do not use `latest` during the implementation.
- Minions listens on `0.0.0.0:6969`, but port `6969` is never made public.
- The browser only calls same-origin Alphi APIs. `AGENT37_API_KEY` stays server-only and is sent to Agent37 preview URLs only through `X-Agent37-Key`.
- Install the Hermes task-management skill after instance creation over Agent37 exec; do not bake it into the masked persistent home volume.
- Tasks, Skills, and Schedules are available only when the mirrored agent template has base name `alfi-agent`.
- All new views work at 320px width, preserve drawer/focus/touch behavior, and add no service-worker fetch handler or private-data cache.
- Use automated tests and API probes only; do not perform visual browser testing.
- Keep `package-lock.json` unchanged and unstaged.
- App work remains on `feat/alphi-minions`; do not change the local `origin` remote.

---

### Task 1: Create the separate Alfi Agent image repository and failing image contract

**Files:**
- Create repository: `C:\Users\Ran\Desktop\AI Projects\Copmosio Env\alfi-agent-image`
- Create: `alfi-agent-image/package.json`
- Create: `alfi-agent-image/scripts/verify-image.mjs`
- Create: `alfi-agent-image/scripts/release-agent.mjs`
- Create: `alfi-agent-image/template/Dockerfile`
- Create: `alfi-agent-image/template/bin/alfi.mjs`
- Create: `alfi-agent-image/template/s6-rc.d/alfi-minions/type`
- Create: `alfi-agent-image/template/s6-rc.d/alfi-minions/run`
- Create: `alfi-agent-image/template/s6-rc.d/user/contents.d/alfi-minions`

**Interfaces:**
- Consumes: the Agent37 custom-image cloud-build contract and the inherited Hermes s6-overlay entrypoint.
- Produces: a build context that installs `minions`, installs `/usr/local/bin/alfi`, and declares one supervised Minions service without overriding `ENTRYPOINT`.

- [ ] **Step 1: Initialize the dedicated repository**

Create the sibling directory, initialize Git on `main`, and add only `package.json`, `scripts/`, and `template/`. The package scripts are:

```json
{
  "name": "alfi-agent-image",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "verify": "node scripts/verify-image.mjs",
    "release": "node scripts/release-agent.mjs"
  }
}
```

- [ ] **Step 2: Write the failing deterministic image verifier**

`scripts/verify-image.mjs` reads the Dockerfile, CLI, and s6 files and fails unless all of these exact contracts hold:

```js
const requiredDockerTokens = [
  "FROM ghcr.io/agent37-platform/hermes:2026.08.19c",
  "NPM_CONFIG_PREFIX=/usr/local npm install -g minionsai@0.1.27",
  "COPY bin/alfi.mjs /usr/local/bin/alfi",
  "COPY s6-rc.d/alfi-minions /etc/s6-overlay/s6-rc.d/alfi-minions",
  "COPY s6-rc.d/user/contents.d/alfi-minions /etc/s6-overlay/s6-rc.d/user/contents.d/alfi-minions",
  "USER node",
];
const forbiddenDockerTokens = ["ENTRYPOINT", "CMD", "npm install -g minionsai@latest", "/home/node/"];
const requiredRunTokens = [
  "#!/command/with-contenv bash",
  "exec s6-setuidgid node env",
  "PORT=6969",
  "MINIONS_HOME=/home/node/.minions",
  "minions",
];
```

It also requires the CLI verbs `list`, `show`, `create`, `move`, `delete`, the loopback base `http://127.0.0.1:6969/api`, JSON output, and `--yes` for deletion. Run `npm run verify`; expect failure because implementation files are incomplete.

- [ ] **Step 3: Commit the red contract with repository scaffold**

```powershell
git add package.json scripts/verify-image.mjs
git commit -m "test: define alfi agent image contract"
```

### Task 2: Implement the pinned image, supervised Minions service, and local task CLI

**Files:**
- Modify: `alfi-agent-image/template/Dockerfile`
- Create: `alfi-agent-image/template/bin/alfi.mjs`
- Create: `alfi-agent-image/template/s6-rc.d/alfi-minions/type`
- Create: `alfi-agent-image/template/s6-rc.d/alfi-minions/run`
- Create: `alfi-agent-image/template/s6-rc.d/user/contents.d/alfi-minions`
- Test: `alfi-agent-image/scripts/verify-image.mjs`

**Interfaces:**
- Consumes: Minions task routes under `http://127.0.0.1:6969/api/tasks`.
- Produces: `alfi --version` and `alfi tasks {list,show,create,move,delete}` with stable JSON stdout and non-zero error exits.

- [ ] **Step 1: Implement the image without replacing the inherited entrypoint**

Use this Dockerfile shape:

```dockerfile
FROM ghcr.io/agent37-platform/hermes:2026.08.19c

USER root
RUN NPM_CONFIG_PREFIX=/usr/local npm install -g minionsai@0.1.27 \
 && command -v minions >/dev/null \
 && npm cache clean --force
COPY --chmod=0755 bin/alfi.mjs /usr/local/bin/alfi
COPY s6-rc.d/alfi-minions /etc/s6-overlay/s6-rc.d/alfi-minions
COPY s6-rc.d/user/contents.d/alfi-minions /etc/s6-overlay/s6-rc.d/user/contents.d/alfi-minions
USER node
```

The service `type` contains `longrun`; the `user/contents.d/alfi-minions` file is empty; the executable `run` file contains:

```bash
#!/command/with-contenv bash
exec s6-setuidgid node env \
  PORT=6969 \
  MINIONS_HOME=/home/node/.minions \
  HERMES_AGENT_DIR=/home/node/.hermes/hermes-agent \
  minions
```

- [ ] **Step 2: Implement the dependency-free CLI**

`alfi.mjs` parses `process.argv`, calls `fetch()` against `ALFI_MINIONS_URL || "http://127.0.0.1:6969/api"`, and maps commands exactly:

```text
alfi tasks list                         GET    /tasks
alfi tasks show <id>                    GET    /tasks/<id>
alfi tasks create --title T --description D
                                        POST   /tasks {title,description}
alfi tasks move <id> <status>           POST   /tasks/<id>/move {status}
alfi tasks delete <id> --yes            DELETE /tasks/<id>
```

Require `description` on create, restrict status to `in_progress|in_review|done`, require `--yes` for delete, print only the upstream JSON on success, and print `{ "ok": false, "error": "..." }` to stderr with exit code `1` on transport or HTTP failure.

- [ ] **Step 3: Run the contract and syntax checks**

```powershell
npm run verify
node --check template/bin/alfi.mjs
```

Expected: `Alfi Agent image verification passed.` and both commands exit `0`.

- [ ] **Step 4: Commit the image implementation**

```powershell
git add template scripts/verify-image.mjs
git commit -m "feat: build alfi agent with minions and task cli"
```

### Task 3: Add the Alfi Agent catalog entry and provision the Hermes CLI skill

**Files:**
- Modify: `agent37-starter-kit/src/config/agents.ts`
- Modify: `agent37-starter-kit/src/lib/agent37.ts`
- Create: `agent37-starter-kit/src/lib/alfi-task-skill.ts`
- Modify: `agent37-starter-kit/src/app/api/agents/route.ts`
- Create: `agent37-starter-kit/scripts/verify-alfi-provisioning.mjs`

**Interfaces:**
- Consumes: published template name `alfi-agent@1` and Agent37 `POST /v1/instances/{id}/exec`.
- Produces: an `Alfi Agent` creation card and an idempotently installed `~/.hermes/skills/alfi-task-manager/SKILL.md`.

- [ ] **Step 1: Write the failing provisioning contract**

The verifier requires:

```js
const requiredCatalog = [
  'id: "alfi-agent"',
  'template: "alfi-agent@1"',
  'label: "Alfi Agent"',
  'capabilities: ["minions"]',
];
const requiredProvisioning = [
  "agent37.exec",
  "ALFI_TASK_MANAGER_SKILL",
  'templateBaseName(agent.template) === "alfi-agent"',
  "base64",
  "~/.hermes/skills/alfi-task-manager/SKILL.md",
];
```

Run `node scripts/verify-alfi-provisioning.mjs`; expect failure before implementation.

- [ ] **Step 2: Add template capability helpers**

Extend `AgentTypeOption` with `capabilities?: readonly ("minions")[]`. Add the `Alfi Agent` option using `alfi-agent@1`, plus:

```ts
export function templateBaseName(template?: string | null): string {
  return (template ?? "").split("@", 1)[0];
}

export function isAlfiAgentTemplate(template?: string | null): boolean {
  return templateBaseName(template) === "alfi-agent";
}
```

Keep `templateAppPorts` at `[9119, 7681, 8080]` for Alfi Agent. Do not add `6969` to `PORT_LABELS` or any browser-openable list; the server-side Minions adapter derives that preview origin directly.

- [ ] **Step 3: Add Agent37 exec and skill installation**

Add:

```ts
exec: (id: string, command: string) =>
  call<{ stdout: string; stderr: string; exit_code: number }>(`/instances/${id}/exec`, {
    method: "POST",
    body: JSON.stringify({ command }),
  }),
```

`ALFI_TASK_MANAGER_SKILL` instructs Hermes to use `alfi tasks`, return task IDs, restrict statuses, and obtain explicit confirmation before `alfi tasks delete <id> --yes`. After creating an Alfi Agent and before inserting its mirror row, base64-encode the skill and execute one idempotent `mkdir`/`base64 -d` command. If installation fails, delete the new instance through the existing orphan rollback and return a provisioning error.

- [ ] **Step 4: Verify and commit provisioning**

```powershell
node scripts/verify-alfi-provisioning.mjs
npm run typecheck
git diff --check
git add src/config/agents.ts src/lib/agent37.ts src/lib/alfi-task-skill.ts src/app/api/agents/route.ts scripts/verify-alfi-provisioning.mjs
git commit -m "feat: provision alfi agents with task cli skill"
```

### Task 4: Add the server-only Minions adapter and capability-gated BFF

**Files:**
- Create: `agent37-starter-kit/src/lib/minions/types.ts`
- Create: `agent37-starter-kit/src/lib/minions/client.ts`
- Create: `agent37-starter-kit/src/lib/minions/access.ts`
- Create: `agent37-starter-kit/src/app/api/agents/[id]/minions/[[...path]]/route.ts`
- Create: `agent37-starter-kit/scripts/verify-minions-bff.mjs`

**Interfaces:**
- Consumes: same-origin paths `/api/agents/{id}/minions/{path}` and Agent37 preview origin `https://{id}-6969.agent37.app/api/{path}`.
- Produces: authenticated raw HTTP forwarding for the approved Minions routes, including JSON, multipart uploads, and SSE.

- [ ] **Step 1: Write the failing BFF contract**

Require `server-only`, `requireAgentAccess`, `isAlfiAgentTemplate(row.template)`, preview origin construction, `X-Agent37-Key`, and a path/method allowlist. Explicitly reject path traversal, unknown roots, mutation by non-admin users, and any attempt to forward browser authentication headers.

- [ ] **Step 2: Define shared Minions types**

Copy only the used stable shapes from Minions `shared/types.ts`: `TaskStatus`, `Task`, `SkillMeta`, `ClawHubSkillSummary`, `ScheduledTask`, `ScheduledTaskInput`, `ScheduledTaskRun`, and their response envelopes. Do not import the Minions package into the web app.

- [ ] **Step 3: Implement capability access and raw preview fetch**

`requireMinionsAccess(id, access)` calls `requireAgentAccess`, then throws `ApiError(404, "not_found", "Minions is not available for this agent")` unless `isAlfiAgentTemplate(row.template)`.

`minionsFetch(id, path, init)` constructs only:

```ts
const origin = `https://${id}-6969.agent37.app`;
return fetch(`${origin}/api/${path}`, {
  ...init,
  headers: { "X-Agent37-Key": key, ...safeContentHeaders },
  cache: "no-store",
});
```

- [ ] **Step 4: Implement the route allowlist and response streaming**

Allow these roots and operations:

```text
GET/POST             tasks
GET/PATCH/DELETE     tasks/:id
POST                 tasks/:id/move
GET                  events
GET                  skills
GET                  skills/:id/content
GET                  skills/registry/search|browse
GET                  skills/registry/:slug/content|scan
POST                 skills/install|import
DELETE               skills/:id
GET/POST              scheduled-tasks
GET/PATCH/DELETE      scheduled-tasks/:id
POST                  scheduled-tasks/:id/pause|resume|run
GET                   scheduled-tasks/:id/runs
GET                   scheduled-tasks/:id/runs/:runId/content
```

Reads require member access; every mutation requires admin access. Forward `Content-Type` and request bytes only; never forward `Cookie`, `Authorization`, or `X-Agent37-Key` from the browser. Return the upstream status/body/content-type and preserve SSE streaming.

- [ ] **Step 5: Verify and commit the BFF**

```powershell
node scripts/verify-minions-bff.mjs
npm run typecheck
git diff --check
git add src/lib/minions src/app/api/agents/[id]/minions scripts/verify-minions-bff.mjs
git commit -m "feat: add secure minions bff"
```

### Task 5: Add responsive Tasks management

**Files:**
- Create: `agent37-starter-kit/src/components/minions/useTasks.ts`
- Create: `agent37-starter-kit/src/components/minions/TasksTab.tsx`
- Modify: `agent37-starter-kit/src/lib/dashboard-tabs.ts`
- Modify: `agent37-starter-kit/src/app/dashboard/agents/[agentId]/[[...tab]]/page.tsx`
- Modify: `agent37-starter-kit/src/components/AgentWorkspace.tsx`
- Modify: `agent37-starter-kit/scripts/verify-mobile.mjs`
- Create: `agent37-starter-kit/scripts/verify-minions-ui.mjs`

**Interfaces:**
- Consumes: task BFF routes and `/events` SSE.
- Produces: Alfi-only `/dashboard/agents/{id}/tasks`, three task states, create/edit/move/delete actions, and live refresh.

- [ ] **Step 1: Write failing tab and mobile contracts**

Require `tasks|skills|schedules` in the shared grammar, server-side `isAlfiAgentTemplate(row.template)` gating before rendering one of those tabs, conditional navigation entries, 44px touch targets, `md:grid-cols-3` desktop columns, a single-column mobile layout, `overflow-wrap:anywhere`, and no page-level horizontal overflow.

- [ ] **Step 2: Make the route grammar capability-aware**

Keep `parseAgentTab` syntactic. In the server page, after loading the row, call `notFound()` when a Minions tab is requested for a non-Alfi template. Pass `minionsEnabled={isAlfiAgentTemplate(row.template)}` to `AgentWorkspace`, and filter the navigation list using that flag.

- [ ] **Step 3: Implement task state and actions**

`useTasks(agentId)` loads `/tasks`, opens an EventSource to `/events`, reloads on task events, and exposes `createTask`, `moveTask`, `updateTask`, and `deleteTask`. `TasksTab` renders a create dialog and status sections. Desktop uses three columns; mobile uses stacked sections/cards. Delete uses the existing `ConfirmDialog`.

- [ ] **Step 4: Verify and commit Tasks**

```powershell
node scripts/verify-minions-ui.mjs
node scripts/verify-mobile.mjs
npm run typecheck
git diff --check
git add src/components/minions src/components/AgentWorkspace.tsx src/lib/dashboard-tabs.ts src/app/dashboard/agents/[agentId]/[[...tab]]/page.tsx scripts/verify-minions-ui.mjs scripts/verify-mobile.mjs
git commit -m "feat: add responsive alfi task board"
```

### Task 6: Add responsive Skills management

**Files:**
- Create: `agent37-starter-kit/src/components/minions/SkillsTab.tsx`
- Create: `agent37-starter-kit/src/components/minions/useSkills.ts`
- Modify: `agent37-starter-kit/src/components/AgentWorkspace.tsx`
- Modify: `agent37-starter-kit/scripts/verify-minions-ui.mjs`
- Modify: `agent37-starter-kit/scripts/verify-mobile.mjs`

**Interfaces:**
- Consumes: installed, registry, content, install, import, and delete BFF routes.
- Produces: browse/installed modes with content inspection and safe installation/import actions.

- [ ] **Step 1: Extend the failing UI contracts**

Require a search input, Browse/Installed controls, installed skill cards, content dialog, install action, multipart import input, delete confirmation, wrapped long identifiers, mobile single-column cards, and desktop multi-column enhancement.

- [ ] **Step 2: Implement the Skills state layer**

`useSkills(agentId)` keeps separate installed and registry states. Encode registry query parameters, send `{ provider: "clawhub", slug, ownerHandle, version }` for installs, send `FormData` for imports without setting `Content-Type`, and reload installed skills after mutations.

- [ ] **Step 3: Implement the responsive Skills tab**

Use existing Button/Dialog/ConfirmDialog components. Do not render registry HTML; display plain metadata and `SKILL.md` content through the existing safe Markdown component or a pre-wrapped text view. Keep all action buttons touch-sized and card text breakable at 320px.

- [ ] **Step 4: Verify and commit Skills**

```powershell
node scripts/verify-minions-ui.mjs
node scripts/verify-mobile.mjs
npm run typecheck
git diff --check
git add src/components/minions/SkillsTab.tsx src/components/minions/useSkills.ts src/components/AgentWorkspace.tsx scripts/verify-minions-ui.mjs scripts/verify-mobile.mjs
git commit -m "feat: add responsive alfi skills management"
```

### Task 7: Add responsive Schedules management and run inspection

**Files:**
- Create: `agent37-starter-kit/src/components/minions/SchedulesTab.tsx`
- Create: `agent37-starter-kit/src/components/minions/useSchedules.ts`
- Modify: `agent37-starter-kit/src/components/AgentWorkspace.tsx`
- Modify: `agent37-starter-kit/scripts/verify-minions-ui.mjs`
- Modify: `agent37-starter-kit/scripts/verify-mobile.mjs`

**Interfaces:**
- Consumes: scheduled-task CRUD/action/run BFF routes.
- Produces: create/edit/pause/resume/run/delete and run-output inspection for Alfi Agent schedules.

- [ ] **Step 1: Extend the failing schedule contract**

Require `name`, `prompt`, and `schedule` fields; enabled/state/next-run/last-status display; pause/resume/run/delete controls; runs list; output dialog; wrapped error text; and mobile card layout.

- [ ] **Step 2: Implement schedule state and validation**

`useSchedules(agentId)` posts `{ name, prompt, schedule }`, patches the same allowed fields, maps actions to `/pause`, `/resume`, and `/run`, and loads `/runs` plus `/content` only when the user opens details. Client validation requires non-empty prompt and schedule; upstream validation remains authoritative.

- [ ] **Step 3: Implement the responsive Schedules tab**

Use cards at all widths, enhancing to two columns on larger screens. Keep status/actions wrapped, format timestamps defensively, and expose full upstream errors without internal URLs or credentials.

- [ ] **Step 4: Verify and commit Schedules**

```powershell
node scripts/verify-minions-ui.mjs
node scripts/verify-mobile.mjs
npm run typecheck
git diff --check
git add src/components/minions/SchedulesTab.tsx src/components/minions/useSchedules.ts src/components/AgentWorkspace.tsx scripts/verify-minions-ui.mjs scripts/verify-mobile.mjs
git commit -m "feat: add responsive alfi schedules management"
```

### Task 8: Publish revision 1 and verify one isolated Alfi Agent instance

**Files:**
- No app source changes.
- Consumes local repository: `alfi-agent-image`.

**Interfaces:**
- Consumes: Agent37 cloud build and instance APIs.
- Produces: immutable workspace template `alfi-agent@1` and one isolated test instance.

- [ ] **Step 1: Publish the image**

Run from `alfi-agent-image` with the valid workspace key from the root `.env`, without printing it:

```powershell
npx.cmd --yes agent37 templates build template --name alfi-agent
```

Wait for success and verify `GET /v1/templates/alfi-agent@1` returns revision `1`, an image digest, and default port `3737` or the inherited Hermes fallback.

- [ ] **Step 2: Create one test instance**

Create it with `template: "alfi-agent@1"`, normal 2 vCPU / 4 GB / 6 GB resources, metadata identifying it as the Alphi Minions test, and a bounded monthly budget. Record the instance ID without exposing credentials.

- [ ] **Step 3: Verify image runtime automatically**

Require all probes to pass:

```text
GET https://{id}.agent37.app/v1/health              -> Hermes healthy
GET https://{id}-6969.agent37.app/api/health        -> Minions and Hermes worker healthy
exec: minions --version                              -> 0.1.27
exec: alfi --version                                 -> 0.1.0
exec: alfi tasks create/list/show/move/delete --yes  -> shared task lifecycle succeeds
```

Use `X-Agent37-Key` only in server/read-only probe headers. Do not create a public port.

### Task 9: Final regression, branch push, and non-production Vercel preview

**Files:**
- No planned source changes unless verification exposes a defect.

**Interfaces:**
- Consumes: committed `feat/alphi-minions`, image revision `alfi-agent@1`, and the existing Vercel project.
- Produces: an automatically verified preview deployment; production remains on commit `69773da`.

- [ ] **Step 1: Run the full automated gate**

```powershell
node scripts/verify-brand.mjs
node scripts/verify-mobile.mjs
node scripts/verify-pwa.mjs
node scripts/verify-alfi-provisioning.mjs
node scripts/verify-minions-bff.mjs
node scripts/verify-minions-ui.mjs
npm run typecheck
npm run build
git diff --check
git status --short
```

Expected: all commands exit `0`; the known multiple-lockfile warning is acceptable; the worktree is clean; `package-lock.json` is unchanged.

- [ ] **Step 2: Push without changing origin**

```powershell
git push https://github.com/RanTheUnderOne/starter-kit.git feat/alphi-minions:feat/alphi-minions
```

Record the exact pushed SHA. Do not modify the local `origin`, which remains `agent37-platform/starter-kit`.

- [ ] **Step 3: Deploy a preview only**

Create a Vercel preview deployment from the exact `feat/alphi-minions` SHA. Do not promote it to production. Verify deployment status `READY`, HTTP success, authentication redirect behavior, PWA assets, and API authorization failures automatically.

- [ ] **Step 4: Run the authenticated end-to-end contract**

Through the Alphi preview BFF and the isolated test agent, verify that one task created by `alfi tasks` appears in the web Tasks response, one web-created task appears in `alfi tasks list`, one skill install becomes visible to Hermes, and one schedule completes the pause/resume/run lifecycle. Preserve test identifiers in the handoff; do not delete the test instance unless the user requests it.
