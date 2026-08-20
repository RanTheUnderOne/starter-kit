import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const drawerHookPath = resolve(root, "src/components/useMobileDrawer.ts");
const files = {
  dashboard: readFileSync(resolve(root, "src/components/DashboardShell.tsx"), "utf8"),
  workspace: readFileSync(resolve(root, "src/components/AgentWorkspace.tsx"), "utf8"),
  agents: readFileSync(resolve(root, "src/components/AgentsView.tsx"), "utf8"),
  members: readFileSync(resolve(root, "src/components/MembersView.tsx"), "utf8"),
  settings: readFileSync(resolve(root, "src/components/SettingsView.tsx"), "utf8"),
  filesView: readFileSync(resolve(root, "src/components/files/FilesView.tsx"), "utf8"),
  chatView: readFileSync(resolve(root, "src/components/chat/ChatView.tsx"), "utf8"),
  chatMessages: readFileSync(resolve(root, "src/components/chat/ChatMessages.tsx"), "utf8"),
  chatSidebar: readFileSync(resolve(root, "src/components/chat/ChatSidebar.tsx"), "utf8"),
  agentSettings: readFileSync(resolve(root, "src/components/AgentSettingsTab.tsx"), "utf8"),
  drawerHook: existsSync(drawerHookPath) ? readFileSync(drawerHookPath, "utf8") : "",
};
const failures = [];

function requireTokens(file, tokens) {
  for (const token of tokens) {
    if (!files[file].includes(token)) failures.push(`${file} is missing ${token}`);
  }
}

function requireTokenCount(file, token, count) {
  const actual = files[file].split(token).length - 1;
  if (actual < count) failures.push(`${file} needs ${count} occurrences of ${token}; found ${actual}`);
}

function requireSection(file, label, startToken, endToken, tokens) {
  const start = files[file].indexOf(startToken);
  const end = files[file].indexOf(endToken, start + startToken.length);
  if (start === -1 || end === -1) {
    failures.push(`${file} is missing ${label} boundaries`);
    return;
  }
  const section = files[file].slice(start, end);
  for (const token of tokens) {
    if (!section.includes(token)) {
      failures.push(`${file} is missing ${label}: ${token}`);
    }
  }
}

function forbidSectionToken(file, label, startToken, endToken, token) {
  const start = files[file].indexOf(startToken);
  const end = files[file].indexOf(endToken, start + startToken.length);
  if (start === -1 || end === -1) {
    failures.push(`${file} is missing ${label} boundaries`);
    return;
  }
  if (files[file].slice(start, end).includes(token)) {
    failures.push(`${file} ${label} must not include ${token}`);
  }
}

requireTokens("dashboard", [
  "md:hidden",
  'aria-label="Open navigation menu"',
  "fixed inset-y-0 left-0",
  "-translate-x-full md:static md:translate-x-0",
  "aria-label=\"Close navigation menu\"",
  "useEffect(() => {\n    closeMenu();\n  }, [pathname, closeMenu]);",
  "inert={!isDesktop && !menuOpen}",
  "aria-hidden={!isDesktop && !menuOpen}",
  "useMobileDrawer()",
  "ref={triggerRef}",
  "ref={drawerRef}",
  'role={!isDesktop ? "dialog" : undefined}',
  'aria-label="Dashboard navigation"',
  "aria-modal={!isDesktop && menuOpen ? true : undefined}",
  "tabIndex={-1}",
  "onKeyDown={onDrawerKeyDown}",
  "inert={!isDesktop && menuOpen}",
  "aria-hidden={!isDesktop && menuOpen}",
  "min-h-dvh md:min-h-screen",
  "min-h-[calc(100dvh-57px)] md:min-h-screen",
]);
requireTokens("workspace", [
  "md:hidden",
  'aria-label="Open agent menu"',
  "fixed inset-y-0 left-0",
  "-translate-x-full md:static md:translate-x-0",
  "aria-label=\"Close agent menu\"",
  "touch-manipulation",
  "onClick={() => selectTab(t.id)}",
  "inert={!isDesktop && !menuOpen}",
  "aria-hidden={!isDesktop && !menuOpen}",
  "useMobileDrawer()",
  "ref={triggerRef}",
  "ref={drawerRef}",
  'role={!isDesktop ? "dialog" : undefined}',
  'aria-label="Agent navigation"',
  "aria-modal={!isDesktop && menuOpen ? true : undefined}",
  "tabIndex={-1}",
  "onKeyDown={onDrawerKeyDown}",
  "inert={!isDesktop && menuOpen}",
  "aria-hidden={!isDesktop && menuOpen}",
  "flex h-dvh flex-col md:h-screen md:flex-row",
  "<ChatSidebar onNavigate={closeMenu} />",
]);
requireTokens("drawerHook", [
  'window.matchMedia("(min-width: 768px)")',
  "if (mediaQuery.matches) setMenuOpen(false);",
  "requestAnimationFrame",
  "drawerRef.current?.focus()",
  "triggerRef.current?.focus()",
  'event.key === "Escape"',
  'event.key !== "Tab"',
  "event.shiftKey",
  "drawer.contains(active)",
  "focusable[0]",
  "focusable[focusable.length - 1]",
]);

requireTokens("agents", [
  'className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"',
  'className="space-y-3 md:hidden"',
  'className="hidden overflow-x-auto rounded-lg border md:block"',
  "min-w-0 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]",
]);
requireSection(
  "agents",
  "complete mobile agent cards",
  '<div className="space-y-3 md:hidden">',
  '<div className="hidden overflow-x-auto rounded-lg border md:block">',
  [
    "<AgentNameCell",
    "agent={a}",
    "<Badge",
    "variant={statusVariant(a.live_status)}",
    '{a.live_status ?? "unknown"}',
    "{a.status_reason && (",
    "{a.status_reason.message}",
    'className="break-words text-xs text-destructive [overflow-wrap:anywhere]"',
    "{a.template ?? \"-\"}",
    "{a.cpu} vCPU · {a.memory} GB · {a.disk} GB",
    'className="flex flex-wrap items-center gap-2"',
    '<Link href={agentTabPath(a.agent37_id, "chat")}>',
    "<OpenPortButtons",
    "ports={a.ports}",
    "<AgentOptionsMenu agent={a} onChanged={load} />",
    'className="min-w-0 max-w-full whitespace-normal break-words [overflow-wrap:anywhere]"',
    'title={a.live_status ?? "unknown"}',
  ]
);
requireTokens("members", [
  'className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"',
  'className="space-y-3 sm:hidden"',
  'className="hidden overflow-hidden rounded-lg border sm:block"',
  "min-w-0 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]",
  'className="flex flex-col gap-2 sm:flex-row sm:items-center"',
  'className="flex flex-wrap items-center gap-2"',
]);
requireSection(
  "members",
  "complete mobile member cards",
  '<div className="space-y-3 sm:hidden">',
  '<div className="hidden overflow-hidden rounded-lg border sm:block">',
  [
    "{m.email}",
    "{m.role.charAt(0).toUpperCase() + m.role.slice(1)}",
    "Added {formatDate(m.created_at)}",
    "onClick={() => removeMember(m.user_id)}",
    "<Trash2",
    "Remove",
  ]
);
requireTokenCount("settings", "flex flex-col gap-2 sm:flex-row", 2);
requireTokens("settings", [
  "min-w-0 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]",
  "{current.name}",
]);
requireTokens("filesView", [
  'className="space-y-3 md:hidden"',
  'className="hidden overflow-x-auto rounded-lg border bg-card md:block"',
  "flex shrink-0 flex-wrap items-center gap-1",
]);
requireSection(
  "filesView",
  "interactive mobile file cards",
  '<div className="space-y-3 md:hidden">',
  '<div className="hidden overflow-x-auto rounded-lg border bg-card md:block">',
  [
    "{...entryHandlers(entry)}",
    'formatBytes(entry.size) || "Unknown size"',
    'formatMtime(entry.modified) || "No modified date"',
    "onClick={() => openEntry(entry)}",
    "<SelectedActions",
    "entry={entry}",
    "onRename={startRename}",
    "onDelete={selectForDelete}",
  ]
);
requireTokens("filesView", ["if (e.target !== e.currentTarget) return;"]);
forbidSectionToken(
  "filesView",
  "mobile list cards",
  '<div className="space-y-3 md:hidden">',
  '<div className="hidden overflow-x-auto rounded-lg border bg-card md:block">',
  "aria-selected={selected}"
);
forbidSectionToken(
  "filesView",
  "grid cards",
  '<div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">',
  "{fb.truncated &&",
  "aria-selected={selected}"
);
requireTokens("chatView", [
  "px-3 sm:px-6 md:px-10",
  'showWelcome ? "flex flex-1 flex-col items-center justify-end px-2 pb-4 sm:px-4"',
  'showWelcome ? "w-full px-3 sm:px-6 md:px-10" : "bg-background px-3 py-3 sm:px-6 sm:py-4 md:px-10"',
  "px-3 pt-3 text-center sm:px-4",
]);
requireTokens("chatMessages", ["px-3 py-4 sm:px-5 sm:py-6"]);
requireTokens("chatSidebar", [
  "onNavigate?: () => void",
  "function createNewChat()",
  "function openSession(sessionId: string)",
  "onClick={createNewChat}",
  "onClick={() => openSession(s.session_id)}",
  "md:group-hover:opacity-100",
  "md:group-focus-within:opacity-100",
  "md:focus-visible:opacity-100",
]);
requireSection("chatSidebar", "new-chat navigation callback", "function createNewChat()", "function openSession", [
  "startNewChat();",
  "onNavigate?.();",
]);
requireSection("chatSidebar", "thread navigation callback", "function openSession", "function startRename", [
  "selectSession(sessionId);",
  "onNavigate?.();",
]);
requireTokenCount("chatSidebar", "size-11", 2);
requireTokenCount("chatSidebar", "md:size-7", 2);
requireTokenCount("chatSidebar", "onNavigate?.();", 2);
requireTokens("agentSettings", [
  "break-words text-xs text-destructive [overflow-wrap:anywhere]",
  'className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"',
  'className="flex flex-wrap items-center gap-1.5 sm:shrink-0"',
  'className="grid grid-cols-1 gap-3 sm:grid-cols-3"',
  "flex flex-col gap-1 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between",
  "{calls} calls · {usd(cost)}",
  "<Badge",
  "variant={statusVariant(agent.live_status)}",
  '{agent.live_status ?? "unknown"}',
  "min-w-0 max-w-full whitespace-normal break-words [overflow-wrap:anywhere] sm:max-w-none sm:whitespace-nowrap sm:break-normal sm:[overflow-wrap:normal]",
  'title={agent.live_status ?? "unknown"}',
]);
requireSection(
  "agentSettings",
  "wrapped agent status reason",
  "{agent.status_reason && (",
  "</header>",
  [
    "{agent.status_reason.message}",
    'title={agent.status_reason.message}',
    'className="break-words text-xs text-destructive [overflow-wrap:anywhere]"',
  ]
);
requireSection(
  "agentSettings",
  "responsive template badge",
  "{templateLabel(agent) && (",
  "{agent.past_due &&",
  [
    "<Badge",
    'variant="outline"',
    "{templateLabel(agent)}",
    'title={templateLabel(agent) ?? undefined}',
    "min-w-0 max-w-full whitespace-normal break-words [overflow-wrap:anywhere] sm:max-w-none sm:whitespace-nowrap sm:break-normal sm:[overflow-wrap:normal]",
  ]
);

if (failures.length > 0) {
  console.error("Mobile verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Mobile verification passed.");
}
