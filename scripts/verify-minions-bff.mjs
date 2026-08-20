import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function read(path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) {
    failures.push(`${path} is missing`);
    return "";
  }
  return readFileSync(absolute, "utf8");
}

function requireTokens(path, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) failures.push(`${path} is missing ${token}`);
  }
}

const access = read("src/lib/minions/access.ts");
const client = read("src/lib/minions/client.ts");
const types = read("src/lib/minions/types.ts");
const routes = read("src/lib/minions/routes.ts");
const route = read("src/app/api/agents/[id]/minions/[[...path]]/route.ts");

requireTokens("src/lib/minions/access.ts", access, [
  "requireAgentAccess",
  "isAlfiAgentTemplate(row.template)",
  'new ApiError(404, "not_found", "Minions is not available for this agent")',
]);
requireTokens("src/lib/minions/client.ts", client, [
  'import "server-only"',
  "https://${id}-6969.agent37.app",
  '"X-Agent37-Key": key',
  'cache: "no-store"',
  "const contentType = new Headers(init.headers).get(\"content-type\")",
  "...(contentType ? { \"Content-Type\": contentType } : {})",
]);
requireTokens("src/lib/minions/types.ts", types, [
  "TaskStatus",
  "ScheduledTask",
  "ScheduledTaskRun",
  "SkillMeta",
  "description: string | null",
  "agent_model: string | null",
  "created_at: number",
  "schedule: Record<string, unknown> | null",
  "scheduleDisplay: string | null",
  "contextFrom: string[]",
  "repeat?: number | null",
  "displayName: string",
  "summary: string",
]);

if (types.includes("[key: string]: unknown")) {
  failures.push("src/lib/minions/types.ts must not hide shape mismatches behind index signatures");
}
if (client.includes("Object.fromEntries") || client.includes("safeContentHeaders")) {
  failures.push("src/lib/minions/client.ts must forward only an explicit Content-Type allowlist");
}
requireTokens("src/lib/minions/routes.ts", routes, ["isAllowedMinionsRoute", "isIdentifier"]);
requireTokens("src/app/api/agents/[id]/minions/[[...path]]/route.ts", route, [
  "requireMinionsAccess",
  "isAllowedMinionsRoute",
  "X-Agent37-Key",
  "Content-Type",
  "text/event-stream",
  "maxDuration = 300",
]);

try {
  const { isAllowedMinionsRoute } = await import(pathToFileURL(resolve(root, "src/lib/minions/routes.ts")).href);
  const cases = [
    ["GET", ["tasks"], "member"], ["POST", ["tasks"], "admin"],
    ["GET", ["tasks", "task-1"], "member"], ["PATCH", ["tasks", "task-1"], "admin"],
    ["DELETE", ["tasks", "task-1"], "admin"], ["POST", ["tasks", "task-1", "move"], "admin"],
    ["GET", ["events"], "member"], ["GET", ["skills"], "member"],
    ["GET", ["skills", "skill-1", "content"], "member"],
    ["GET", ["skills", "registry", "search"], "member"], ["GET", ["skills", "registry", "browse"], "member"],
    ["GET", ["skills", "registry", "example", "content"], "member"],
    ["GET", ["skills", "registry", "example", "scan"], "member"],
    ["POST", ["skills", "install"], "admin"], ["POST", ["skills", "import"], "admin"],
    ["DELETE", ["skills", "skill-1"], "admin"],
    ["GET", ["scheduled-tasks"], "member"], ["POST", ["scheduled-tasks"], "admin"],
    ["GET", ["scheduled-tasks", "job-1"], "member"], ["PATCH", ["scheduled-tasks", "job-1"], "admin"],
    ["DELETE", ["scheduled-tasks", "job-1"], "admin"],
    ["POST", ["scheduled-tasks", "job-1", "pause"], "admin"], ["POST", ["scheduled-tasks", "job-1", "resume"], "admin"],
    ["POST", ["scheduled-tasks", "job-1", "run"], "admin"],
    ["GET", ["scheduled-tasks", "job-1", "runs"], "member"],
    ["GET", ["scheduled-tasks", "job-1", "runs", "run-1", "content"], "member"],
    ["PUT", ["tasks"], null], ["GET", ["unknown"], null], ["GET", [], null],
    ["GET", ["tasks", ".."], null], ["GET", ["tasks", "."], null], ["GET", ["tasks", "%2e%2e"], null],
    ["GET", ["tasks", "part/other"], null], ["GET", ["tasks", "part\\other"], null],
    ["GET", ["skills", "registry", "slug"], null], ["POST", ["scheduled-tasks", "job-1", "runs"], null],
  ];
  for (const [method, path, expected] of cases) {
    const actual = isAllowedMinionsRoute(method, path);
    if (actual !== expected) failures.push(`route policy ${method} /${path.join("/")} expected ${expected}, got ${actual}`);
  }
} catch (error) {
  failures.push(`route policy could not execute: ${error instanceof Error ? error.message : String(error)}`);
}

for (const forbidden of ["request.headers.get(\"cookie\")", "request.headers.get(\"authorization\")", "request.headers.get(\"x-agent37-key\")"]) {
  if (route.toLowerCase().includes(forbidden)) failures.push(`route must not forward ${forbidden}`);
}

if (failures.length > 0) {
  console.error("Minions BFF verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Minions BFF verification passed.");
}
