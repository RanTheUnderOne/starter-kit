"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlfiMark } from "@/components/AlfiLogo";
import { History, Plus } from "lucide-react";
import { ChatStarters } from "./ChatStarters";
import { ChatSidebar } from "./ChatSidebar";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { cn } from "@/lib/utils";
import { DropOverlay } from "@/components/DropOverlay";
import { ChatComposer } from "./ChatComposer";
import { ChatMessages } from "./ChatMessages";
import { useChatContext } from "./ChatProvider";
import { useChat } from "./useChat";
import { useChatAttachments } from "./useChatAttachments";
import { useLocale } from "@/components/LocaleProvider";



// The conversation pane, rendered full-height in the chat tab's main column. Empty state = a
// centered welcome (heading + big composer + subtitle); once there are messages it becomes a
// scrolling transcript with the composer docked at the bottom. The composer is kept at a STABLE
// position in the tree across both states so it never remounts (preserving the draft, model, and
// effort selection through the first send).
export function ChatView() {
  const {
    agentId,
    agents,
    sessions,
    activeSessionId,
    onChatTab,
    composerFocusToken,
    requestComposerFocus,
    startNewChat,
    onSessionCreated,
    registerRunKiller,
    bumpSession,
  } = useChatContext();
  const { t, locale } = useLocale();
  const he = locale === "he";
  const { isStaff } = useWorkspace();
  const [historyOpen, setHistoryOpen] = useState(false);
  const { messages, isStreaming, loadingHistory, error, send, stop, killRun } = useChat({
    agentId,
    sessionId: activeSessionId,
    onSessionCreated,
    onActivity: bumpSession,
  });

  // Deleting a thread from the rail must also stop any turn still streaming on it.
  useEffect(() => registerRunKiller(killRun), [registerRunKiller, killRun]);

  // Returning to Chat (including Continue with Alfi) focuses the composer on desktop.
  useEffect(() => {
    if (onChatTab) requestComposerFocus();
  }, [onChatTab, requestComposerFocus]);

  // Attachment state lives here (not in the composer) so the ENTIRE pane is a drop zone — a file
  // dropped anywhere over the transcript or composer lands in the same tray. A landed attachment
  // refocuses the composer through the same shared signal selecting/creating a thread uses.
  const att = useChatAttachments(agentId, requestComposerFocus);
  const { clearFiles } = att;

  // Switching threads / starting a new chat empties the staged tray, so a file picked for one
  // conversation can't silently ride along into the next.
  useEffect(() => {
    clearFiles();
  }, [activeSessionId, clearFiles]);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Whether the user is pinned near the bottom — controls whether new tokens auto-scroll.
  const stickRef = useRef(true);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Follow the stream only when the user is already near the bottom.
  useEffect(() => {
    if (!stickRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loadingHistory]);

  const showWelcome = !loadingHistory && messages.length === 0;
  // Memoized so the per-token re-renders during streaming don't re-scan the thread list.
  const activeTitle = useMemo(
    () => sessions.find((s) => s.session_id === activeSessionId)?.title?.trim(),
    [sessions, activeSessionId]
  );
  const headerTitle = activeTitle || (he ? "שיחה עם Alfi" : "Your conversation with Alfi");

  return (
    <div className="alfi-chat relative flex h-full min-h-0 flex-col" {...att.dragHandlers}>
      {att.dragOver && <DropOverlay label="Drop files to attach" />}
      <header className="alfi-chat-header flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium text-foreground">{headerTitle}</h1>
          
        </div>
        <button
          type="button"
          onClick={startNewChat}
          aria-label={he ? "שיחה חדשה" : "New conversation"}
          title={he ? "שיחה חדשה" : "New conversation"}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{he ? "שיחה חדשה" : "New conversation"}</span>
        </button>
      </header>
      <button className="mx-5 mt-3 flex items-center gap-2 self-start text-xs text-muted-foreground lg:hidden" onClick={() => setHistoryOpen(true)}><History size={15} />{he ? "השיחות שלך" : "Your conversations"}</button>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="flex max-h-[80dvh] flex-col"><DialogTitle>{he ? "השיחות שלך" : "Your conversations"}</DialogTitle><DialogDescription>{he ? "ממשיכים מהמקום שבו עצרת." : "Pick up where you left off."}</DialogDescription><div className="min-h-0 overflow-auto" onClick={event => { if ((event.target as HTMLElement).closest("button")) setHistoryOpen(false); }}><ChatSidebar /></div></DialogContent></Dialog>
      {/* Top: scrolling transcript when there are messages; the centered welcome heading when
          empty (justify-end seats it just above the composer). */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={cn(
          "min-h-0",
          showWelcome ? "flex flex-1 flex-col items-center justify-end px-4 pb-4" : "flex-1 overflow-y-auto"
        )}
      >
        {loadingHistory ? (
          <div className="flex h-full items-center justify-center px-6" role="status" aria-label="Loading conversation">
            <div className="w-full max-w-xs rounded-2xl border border-border/70 bg-card/90 p-4 shadow-[0_14px_40px_rgb(15_23_42_/_0.10)]">
              <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                Loading conversation
              </div>
              <div className="space-y-2" aria-hidden="true">
                <div className="h-2.5 w-3/4 animate-pulse rounded-full bg-muted" />
                <div className="h-2.5 w-full animate-pulse rounded-full bg-muted" />
                <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-muted" />
              </div>
            </div>
          </div>
        ) : messages.length > 0 ? (
          <ChatMessages messages={messages} isStreaming={isStreaming} />
        ) : (
          <div className="max-w-xl pb-3 text-center">
            <span className="alfi-welcome-orb"><AlfiMark className="size-16" /></span>
            <p className="alfi-eyebrow mt-6">{he ? "השותף שלך לעסק" : "YOUR PARTNER IN BUSINESS"}</p>
            <h1 className="alfi-welcome-title">
              {he ? "נעשה סדר ביום שלך." : "A little clarity. A lot of progress."}
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted-foreground">{he ? "לידים, לקוחות והצעד הבא. על מה נעבוד יחד?" : "Your leads, your customers, and the next step. What shall we work on?"}</p>
          </div>
        )}
      </div>

      {/* Composer wrapper — the STABLE 2nd child. Its chrome (docked vs bare centered) is a
          className swap so the ChatComposer inside never changes tree position. */}
      <div className={cn("relative", showWelcome ? "w-full px-6 md:px-10" : "bg-background px-6 py-3 md:px-10 sm:py-4")}>
        {/* No hard divider — a short fade dissolves the transcript into the composer instead. */}
        {!showWelcome && (
          <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-background to-transparent" />
        )}
        <div className={cn("mx-auto w-full", showWelcome ? "max-w-2xl" : "max-w-3xl")} aria-live="polite">
          {error && <p role="alert" className="mb-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{isStaff ? error : he ? "לא הצלחנו להשלים את הבקשה. אפשר לנסות שוב; ההודעה שלך נשארה בשיחה." : "We could not complete this request. Please try again; your message remains in the conversation."}</p>}
        </div>
        <ChatComposer
          agentId={agentId}
          isStreaming={isStreaming}
          att={att}
          onSend={send}
          onStop={stop}
          large={showWelcome}
          focusToken={composerFocusToken}
        />
      </div>

      {/* Bottom: balances the vertical centering and carries the welcome subtitle. */}
      {showWelcome && (
        <div className="flex flex-1 flex-col items-center gap-4 px-5 pt-5 pb-5">
          <ChatStarters onStart={send} disabled={isStreaming || loadingHistory} />
          <p className="mt-2 text-center text-[11px] leading-5 text-muted-foreground">{he ? "מתחילים בבדיקה ובטיוטה. פנייה ללקוחות ושינויים בעסק — באישור שלך." : "Start with a review and a draft. Customer outreach and business changes need your approval."}</p>
        </div>
      )}
    </div>
  );
}
