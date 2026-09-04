"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Blocks,
  CalendarClock,
  MessageCircle,
  MessageSquare,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { isTransitional } from "@/lib/format";
import { agentTabPath, parseAgentTab, tabsFor, type AgentTab } from "@/lib/dashboard-tabs";
import { branding } from "@/config/branding";
import type { CronJob, CronRun, MergedAgent, Role } from "@/lib/types";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { useLocale } from "@/components/LocaleProvider";
import { ActiveAgentSwitcher } from "@/components/ActiveAgentSwitcher";
import { AccountMenu } from "@/components/AccountMenu";
import { LanguageToggle } from "@/components/LanguageToggle";
import { AdvancedTab } from "@/components/AdvancedTab";
import { BusinessTab } from "@/components/BusinessTab";
import { SchedulesTab } from "@/components/SchedulesTab";
import { WhatsAppTab } from "@/components/WhatsAppTab";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatView } from "@/components/chat/ChatView";
import { cn } from "@/lib/utils";

const TAB_ICONS: Record<AgentTab, LucideIcon> = {
  chat: MessageSquare,
  schedules: CalendarClock,
  whatsapp: MessageCircle,
  business: Blocks,
  advanced: Shield,
};

// The per-agent tabbed SPA, laid out as a SINGLE left rail + the active tab's pane. The active agent
// is bound to the URL (agentId); the open tab rides the URL as a path segment. Tabs switch via
// history.pushState (no full navigation) so Chat's in-flight stream survives moving between tabs —
// Chat mounts lazily then stays MOUNTED-BUT-HIDDEN. Customer panes mount lazily in the scroll area.
//
// ChatProvider wraps the WHOLE workspace (not just the Chat pane) so the "Chats" thread list can live
// in this one sidebar — folded in under the nav on the Chat tab — instead of a second rail. The chat
// thread also stays open (and streaming) while you visit Schedules/WhatsApp/Business because the
// provider and ChatView never unmount.
export function AgentWorkspace({
  agentId,
  workspaceId,
  role,
  initialTab,
}: {
  agentId: string;
  workspaceId: string;
  role: Role;
  initialTab: AgentTab;
}) {
  const pathname = usePathname();
  const { setCurrentId, isStaff } = useWorkspace();
  const { t } = useLocale();
  const tabs = tabsFor(isStaff);

  // Deep-linking to an agent scopes the WorkspaceProvider to its workspace, so the fleet/switcher
  // and any workspace-derived UI stay in sync after a refresh or shared link.
  useEffect(() => {
    setCurrentId(workspaceId);
  }, [workspaceId, setCurrentId]);

  // Live data for every agent in the workspace: the switcher lists them, and `active` carries this
  // agent's live ports / status / update flag. Poll while any agent is mid-transition (AgentsView's
  // approach), so a starting agent's ports light up without a manual refresh.
  const [agents, setAgents] = useState<MergedAgent[]>([]);
  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ agents: MergedAgent[]; role: Role }>(
        `/api/agents?workspace=${workspaceId}`
      );
      setAgents(data.agents);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!agents.some((a) => isTransitional(a.live_status))) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [agents, load]);

  const active = agents.find((a) => a.agent37_id === agentId) ?? null;

  // The open tab follows the URL (history.pushState updates usePathname in the App Router). Fall
  // back to the server-resolved initialTab on the first paint before the path is parsed. Staff-only
  // Advanced is rejected here as well as on the server.
  const segments = pathname.split("/").filter(Boolean); // ["dashboard","agents",id,tab?]
  const currentTab = parseAgentTab(segments.slice(3), isStaff) ?? initialTab;
  const isChat = currentTab === "chat";

  function selectTab(tab: AgentTab) {
    if (tab === "advanced" && !isStaff) return;
    const path = agentTabPath(agentId, tab);
    if (typeof window !== "undefined" && window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
  }

  function continueWithAlfi(_job: CronJob, _run: CronRun) {
    selectTab("chat");
  }

  // The open chat thread rides the URL as `?session=` (a query param — the agent route only accepts
  // 0–1 tab segments). Read it on mount (refresh / shared link) and on Back/Forward (popstate). Lifted
  // here (out of the Chat pane) so ChatProvider can wrap both this rail and the pane.
  const [urlSessionId, setUrlSessionId] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setUrlSessionId(new URLSearchParams(window.location.search).get("session"));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const chatPath = agentTabPath(agentId, "chat");
  // Write the open thread into the chat URL without adding a path segment. pushState for an explicit
  // switch (so Back returns to the previous thread); replaceState when promoting a freshly-minted
  // session or re-stamping the URL on tab return (so Back doesn't bounce through transient states).
  const navigateToSession = useCallback(
    (sessionId: string | null, mode: "push" | "replace" = "push") => {
      const url = sessionId ? `${chatPath}?session=${encodeURIComponent(sessionId)}` : chatPath;
      if (typeof window !== "undefined") {
        if (mode === "replace") window.history.replaceState(null, "", url);
        else window.history.pushState(null, "", url);
      }
      setUrlSessionId(sessionId);
    },
    [chatPath]
  );

  // Latch Chat mounted on first open, then keep it mounted (hidden) across tab switches.
  // Latched during render (not in an effect) so the mount lands in the same pass as the switch.
  const [chatOpened, setChatOpened] = useState(isChat);
  if (isChat && !chatOpened) setChatOpened(true);

  return (
    <ChatProvider
      agentId={agentId}
      agents={agents}
      urlSessionId={urlSessionId}
      onChatTab={isChat}
      navigateToSession={navigateToSession}
    >
      <div className="flex h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-e border-white/10 bg-[#072f2e] text-[#f4fbf7] lg:flex [--accent:rgb(255_255_255_/_0.08)] [--accent-foreground:#fff] [--background:#072f2e] [--border:rgb(255_255_255_/_0.12)] [--card:#0b3b3a] [--foreground:#f4fbf7] [--input:rgb(255_255_255_/_0.14)] [--muted-foreground:rgb(244_251_247_/_0.65)] [--secondary:rgb(184_240_212_/_0.16)] [--secondary-foreground:#f4fbf7]">
          <div className="flex flex-col p-4 pb-3">
            <div className="flex items-center gap-2 px-2 py-1">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt="" className="h-6 w-6 rounded" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#b8f0d4] text-xs font-bold text-[#072f2e]">
                  A
                </span>
              )}
              <span className="truncate font-semibold tracking-tight">{branding.appName}</span>
            </div>

            <Link
              href="/dashboard"
              className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              {t("nav.back")}
            </Link>

            <div className="mt-3">
              <ActiveAgentSwitcher agents={agents} activeAgentId={agentId} currentTab={currentTab} />
            </div>

            <WorkspaceNav tabs={tabs} currentTab={currentTab} onSelect={selectTab} />
          </div>

          {/* The "Chats" thread list folds into this one rail on the Chat tab (no second sidebar).
              On other tabs a spacer keeps the account footer pinned to the bottom. */}
          {isChat ? (
            <div className="flex min-h-0 flex-1 flex-col border-t border-white/10">
              <ChatSidebar />
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div className="space-y-3 border-t border-white/10 p-4">
            <LanguageToggle tone="dark" />
            <AccountMenu />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-teal-950/8 bg-white/70 px-4 py-2.5 backdrop-blur-md lg:hidden">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-medium text-teal-900/70"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              <span className="truncate">{t("nav.back")}</span>
            </Link>
            <div className="flex items-center gap-1.5">
              <LanguageToggle compact />
              <AccountMenu compact />
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-hidden">
            {/* Chat owns its full height and stays MOUNTED (just hidden) across tab switches. */}
            {chatOpened && (
              <div className={cn("h-full", isChat ? "pb-safe-nav lg:pb-0" : "hidden")}>
                <ChatView />
              </div>
            )}
            {!isChat && (
              <div className="h-full overflow-y-auto pb-safe-nav lg:pb-0">
                {currentTab === "schedules" && (
                  <SchedulesTab agentId={agentId} onContinue={continueWithAlfi} />
                )}
                {currentTab === "whatsapp" && <WhatsAppTab agentId={agentId} role={role} />}
                {currentTab === "business" && <BusinessTab agentId={agentId} role={role} />}
                {currentTab === "advanced" && isStaff && (
                  active ? (
                    <AdvancedTab agentId={agentId} agent={active} role={role} onChanged={load} />
                  ) : (
                    <p className="px-6 py-10 text-sm text-muted-foreground">{t("common.loading")}</p>
                  )
                )}
              </div>
            )}
          </main>
        </div>

        <nav
          aria-label="Alfi"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-teal-950/10 bg-white/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = TAB_ICONS[tab.id];
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-semibold tracking-wide",
                    isActive ? "text-teal-900" : "text-teal-900/45"
                  )}
                >
                  <Icon className={cn("h-5 w-5", tab.id === "advanced" && "text-amber-700")} />
                  <span className="max-w-full truncate">{t(tab.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </ChatProvider>
  );
}

function WorkspaceNav({
  tabs,
  currentTab,
  onSelect,
}: {
  tabs: ReturnType<typeof tabsFor>;
  currentTab: AgentTab;
  onSelect: (tab: AgentTab) => void;
}) {
  const { t } = useLocale();
  return (
    <nav className="mt-5 flex flex-col gap-1">
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab.id];
        const isActive = currentTab === tab.id;
        const staffOnly = tab.id === "advanced";
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
              isActive && staffOnly && "bg-amber-500/20 text-amber-100",
              isActive && !staffOnly && "bg-[#b8f0d4] text-[#072f2e]",
              !isActive && "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon className="h-4 w-4" />
            {t(tab.labelKey)}
          </button>
        );
      })}
    </nav>
  );
}
