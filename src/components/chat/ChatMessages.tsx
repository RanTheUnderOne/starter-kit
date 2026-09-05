"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, FileText, Image as ImageIcon, Loader2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "./Markdown";
import { AlfiMark } from "@/components/AlfiLogo";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { useLocale } from "@/components/LocaleProvider";
import type { ChatMessage, MessageAttachment, ToolEvent } from "./types";

// Files that rode along with a user turn, shown as compact chips above the message bubble.
function MessageAttachments({ attachments }: { attachments: MessageAttachment[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {attachments.map((a, k) => (
        <span
          key={`${a.path}-${k}`}
          title={a.name}
          className="flex items-center gap-1.5 rounded-lg border bg-secondary/60 px-2 py-1 text-xs text-foreground"
        >
          {a.isImage ? (
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="max-w-[12rem] truncate">{a.name}</span>
        </span>
      ))}
    </div>
  );
}

function ThinkingBlock({ content, live }: { content: string; live: boolean }) {
  const [open, setOpen] = useState(live);
  if (!content) return null;
  return (
    <div className="mb-2 rounded-xl border border-border/60 bg-card/70 px-3 py-2 shadow-[0_8px_24px_rgb(15_23_42_/_0.06)]">
      <button
        onClick={() => setOpen(!open)}
        className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>{live ? "Thinking…" : "Thought process"}</span>
        {live && <Loader2 className="h-3 w-3 animate-spin" />}
      </button>
      {open && (
        <div className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap break-words border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground">
          {content}
        </div>
      )}
    </div>
  );
}

function ToolChip({ tool }: { tool: ToolEvent }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
        tool.status === "error" ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground"
      )}
    >
      <Wrench className="h-3.5 w-3.5 shrink-0" />
      <span className="font-medium capitalize">{tool.tool.replace(/_/g, " ")}</span>
      {tool.label && <span className="max-w-[12rem] truncate font-mono opacity-70">{tool.label}</span>}
      {tool.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {tool.status === "completed" && <Check className="h-3.5 w-3.5" />}
      {tool.durationMs != null && <span className="ml-auto tabular-nums opacity-60">{(tool.durationMs / 1000).toFixed(1)}s</span>}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </span>
  );
}

export function ChatMessages({ messages, isStreaming }: { messages: ChatMessage[]; isStreaming: boolean }) {
  const { isStaff } = useWorkspace();
  const { locale } = useLocale();
  return (
    <div className="mx-auto w-full max-w-3xl space-y-9 px-5 py-8 sm:px-8">
      {messages.map((m, i) => {
        if (m.role === "user") {
          const attachments = m.attachments ?? [];
          return (
            <div key={m.id} className="flex items-start gap-3">
              <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#eef0eb] text-[11px] font-medium text-[#657064]">{locale === "he" ? "א" : "Y"}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="pt-1 text-xs font-medium text-foreground">{locale === "he" ? "את/ה" : "You"}</p>
                {attachments.length > 0 && <MessageAttachments attachments={attachments} />}
                {m.content && (
                  <div className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
                    {m.content}
                  </div>
                )}
              </div>
            </div>
          );
        }

        const lastAssistant = i === messages.length - 1 && m.role === "assistant";
        const tools = m.tools ?? [];
        const showDots =
          lastAssistant && isStreaming && !m.content && !m.thinking && !tools.some((t) => t.status === "running");

        return (
          <div key={m.id} className="flex items-start gap-3">
            <AlfiMark className="size-7" />
            <div className="min-w-0 flex-1">
              <p className="mb-3 pt-1 text-xs font-medium text-foreground">Alfi</p>
              {isStaff && m.thinking && <ThinkingBlock content={m.thinking} live={lastAssistant && isStreaming && !m.content} />}
              {tools.length > 0 && (
                <details className="mb-3 text-xs text-muted-foreground">
                  <summary className="cursor-pointer py-1">{tools.length} {locale === "he" ? "פעולות" : "actions"}{tools.some(t => t.status === "error") ? (locale === "he" ? " · נדרשת בדיקה" : " · needs attention") : ""}</summary>
                  <div className="mt-2 space-y-2">
                  {tools.map((t, k) => (
                    isStaff ? <ToolChip key={`${t.tool}-${k}`} tool={t} /> : <div key={`${t.tool}-${k}`} className="rounded-lg border px-3 py-2">{locale === "he" ? "פעולה" : "Action"} {k + 1}<span className="ms-2">{t.status === "error" ? (locale === "he" ? "לא הושלמה" : "Could not complete") : t.status === "running" ? (locale === "he" ? "בתהליך" : "In progress") : (locale === "he" ? "הושלמה" : "Completed")}</span></div>
                  ))}
                  </div>
                </details>
              )}
              {m.content ? <Markdown content={m.content} /> : showDots ? <TypingDots /> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
