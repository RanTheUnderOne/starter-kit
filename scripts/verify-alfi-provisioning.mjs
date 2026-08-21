import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

const agentConfig = read("src/config/agents.ts");
const agent37 = read("src/lib/agent37.ts");
const skill = read("src/lib/alfi-task-skill.ts");
const createRoute = read("src/app/api/agents/route.ts");

requireTokens("src/config/agents.ts", agentConfig, [
  'id: "alfi-agent"',
  'template: "alfi-agent@4"',
  'label: "Alfi Agent"',
  'capabilities: ["minions"]',
  "templateBaseName",
  "isAlfiAgentTemplate",
]);
requireTokens("src/lib/agent37.ts", agent37, ["exec: (id: string, command: string)"]);
requireTokens("src/lib/alfi-task-skill.ts", skill, [
  "ALFI_TASK_MANAGER_SKILL",
  "alfi tasks",
  "--yes",
  "in_progress",
  "in_review",
  "done",
]);
requireTokens("src/app/api/agents/route.ts", createRoute, [
  "agent37.exec",
  "ALFI_TASK_MANAGER_SKILL",
  'templateBaseName(agent.template) === "alfi-agent"',
  "base64",
  "~/.hermes/skills/alfi-task-manager/SKILL.md",
]);

if (agentConfig.includes("6969")) {
  failures.push("src/config/agents.ts must not expose Minions port 6969");
}

if (failures.length > 0) {
  console.error("Alfi provisioning verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Alfi provisioning verification passed.");
}
