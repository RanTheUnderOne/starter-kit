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
import { AlfiLogo } from "@/components/AlfiLogo";
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
  const { t, locale } = useLocale();
  const tabs = tabsFor(isStaff).filter(tab => tab.id !== "whatsapp");

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
      <div className="alfi-workspace flex h-dvh">
        <aside className="alfi-rail hidden w-64 shrink-0 flex-col text-foreground lg:flex">
          <div className="flex flex-col p-4 pb-3">
            <div className="flex items-center gap-2 px-2 py-1">
              <AlfiLogo />
            </div>
            <p className="px-2 pt-3 text-xs text-muted-foreground">{t("brand.tagline")}</p>

            {(isStaff || agents.length > 1) && <Link
              href="/dashboard"
              className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              {t("nav.back")}
            </Link>}

            {(isStaff || agents.length > 1) && <div className="mt-3">
              <ActiveAgentSwitcher agents={agents} activeAgentId={agentId} currentTab={currentTab} />
            </div>}

            <WorkspaceNav tabs={tabs} currentTab={currentTab} onSelect={selectTab} />
          </div>

          {/* The "Chats" thread list folds into this one rail on the Chat tab (no second sidebar).
              On other tabs a spacer keeps the account footer pinned to the bottom. */}
          {isChat ? (
            <div className="flex min-h-0 flex-1 flex-col border-t border-border">
              <ChatSidebar />
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div className="space-y-3 border-t border-border p-4">
            <LanguageToggle />
            <AccountMenu />
          </div>
        </aside>

        <div className="alfi-main flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-border bg-white/70 px-4 py-2.5 backdrop-blur-md lg:hidden">
            <AlfiLogo className="[&>span]:text-2xl [&>svg]:size-7" />
            <div className="flex items-center gap-1.5">
              <LanguageToggle compact />
              <AccountMenu compact />
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-hidden">
            {/* Chat owns its full height and stays MOUNTED (just hidden) across tab switches. */}
            {chatOpened && (
              <div className={cn("h-full", isChat ? "pb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:pb-0" : "hidden")}>
                <ChatView />
              </div>
            )}
            {!isChat && (
              <div className="h-full overflow-y-auto">
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
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = TAB_ICONS[tab.id];
              const isActive = (currentTab === tab.id || (tab.id === "business" && currentTab === "whatsapp"));
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-semibold tracking-wide",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  <Icon className={cn("h-5 w-5", tab.id === "advanced" && "text-amber-700")} />
                  <span className="max-w-full truncate">{tab.id === "schedules" ? (locale === "he" ? "עבודה קבועה" : "Routines") : t(tab.labelKey)}</span>
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
  const { t, locale } = useLocale();
  return (
    <nav className="mt-5 flex flex-col gap-1">
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab.id];
        const isActive = (currentTab === tab.id || (tab.id === "business" && currentTab === "whatsapp"));
        const staffOnly = tab.id === "advanced";
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "alfi-nav-item flex items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-medium transition-colors",
              isActive && staffOnly && "bg-secondary text-foreground",
              isActive && !staffOnly && "bg-secondary text-foreground",
              !isActive && "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.id === "schedules" ? (locale === "he" ? "עבודה קבועה" : "Routines") : t(tab.labelKey)}
          </button>
        );
      })}
    </nav>
  );
}
