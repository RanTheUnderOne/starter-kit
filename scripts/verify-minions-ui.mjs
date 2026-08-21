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

const tabs = read("src/lib/dashboard-tabs.ts");
const page = read("src/app/dashboard/agents/[agentId]/[[...tab]]/page.tsx");
const workspace = read("src/components/AgentWorkspace.tsx");
const hook = read("src/components/minions/useTasks.ts");
const taskTab = read("src/components/minions/TasksTab.tsx");
const skillsHook = read("src/components/minions/useSkills.ts");
const skillsTab = read("src/components/minions/SkillsTab.tsx");
const schedulesHook = read("src/components/minions/useSchedules.ts");
const schedulesTab = read("src/components/minions/SchedulesTab.tsx");
const mobile = read("scripts/verify-mobile.mjs");

requireTokens("src/lib/dashboard-tabs.ts", tabs, ['"tasks"', '"skills"', '"schedules"']);
requireTokens("src/app/dashboard/agents/[agentId]/[[...tab]]/page.tsx", page, [
  "isAlfiAgentTemplate(row.template)",
  "notFound()",
  "minionsEnabled={isAlfiAgentTemplate(row.template)}",
]);
requireTokens("src/components/AgentWorkspace.tsx", workspace, [
  "minionsEnabled",
  "TasksTab",
  "minionsEnabled ?",
  "min-h-11",
]);
requireTokens("src/components/minions/useTasks.ts", hook, [
  "EventSource",
  "tasksPath",
  "createTask",
  "moveTask",
  "updateTask",
  "deleteTask",
]);
requireTokens("src/components/minions/TasksTab.tsx", taskTab, [
  "ConfirmDialog",
  "md:grid-cols-3",
  "grid-cols-1",
  "[overflow-wrap:anywhere]",
  "Create task",
]);
requireTokens("src/components/AgentWorkspace.tsx", workspace, ["SkillsTab", 'id: "skills"']);
requireTokens("src/components/minions/useSkills.ts", skillsHook, [
  "URLSearchParams",
  "registry/search",
  "registry/browse",
  "provider: \"clawhub\"",
  "FormData",
  "relativePaths",
  "Content-Type",
  "deleteSkill",
]);
requireTokens("src/components/minions/SkillsTab.tsx", skillsTab, [
  "Browse",
  "Installed",
  "Search skills",
  "Install",
  "Import skill",
  "ConfirmDialog",
  "ContentDialog",
  "md:grid-cols-2",
  "grid-cols-1",
  "min-h-11",
  "[overflow-wrap:anywhere]",
]);
requireTokens("src/components/AgentWorkspace.tsx", workspace, ["SchedulesTab", 'id: "schedules"']);
requireTokens("src/components/minions/useSchedules.ts", schedulesHook, [
  "scheduled-tasks",
  "createSchedule",
  "updateSchedule",
  "pauseSchedule",
  "resumeSchedule",
  "runSchedule",
  "deleteSchedule",
  "loadRuns",
  "loadRunContent",
]);
requireTokens("src/components/minions/SchedulesTab.tsx", schedulesTab, [
  "Create schedule",
  "Schedule name",
  "Schedule prompt",
  "Schedule expression",
  "Pause",
  "Resume",
  "Run now",
  "Delete",
  "Run history",
  "Output",
  "ConfirmDialog",
  "grid-cols-1",
  "md:grid-cols-2",
  "min-h-11",
  "[overflow-wrap:anywhere]",
]);
requireTokens("scripts/verify-mobile.mjs", mobile, [
  "TasksTab.tsx",
  "md:grid-cols-3",
  "[overflow-wrap:anywhere]",
]);

if (failures.length > 0) {
  console.error("Minions UI verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Minions UI verification passed.");
}
