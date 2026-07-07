"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, readApiError } from "@/lib/api";
import { FILES_ONLY_PROMPT, type SessionDetail } from "@/lib/types";
import { uid, type ChatMessage, type ChatSettings, type MessageAttachment, type ToolEvent, type ToolStatus } from "./types";

export interface SendSettings extends Partial<ChatSettings> {
  files?: string[];
  // Display metadata for the same files (name/path/isImage) — rendered as chips in the user bubble.
  attachments?: MessageAttachment[];
}

interface UseChatArgs {
  agentId: string;
  sessionId: string | null;
  // Called once when a brand-new conversation mints its session id mid-stream. The provider
  // records the rail row; `promote` says whether to also make it the open thread (false when the
  // user has already moved on and the run is finishing in the background).
  onSessionCreated: (sessionId: string, title: string, opts?: { promote?: boolean }) => void;
  // Called when an existing thread gets a new turn, so the rail can bubble it to the top.
  onActivity?: (sessionId: string) => void;
}

// Parse a fetch SSE stream into (event, data) pairs. Handles CRLF, multi-line data, and
// `:keepalive` comment lines. There is no [DONE] sentinel — the stream just ends.
async function readSSE(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: Record<string, unknown>) => void,
  signal: AbortSignal
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");

      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        let event = "message";
        const dataLines: string[] = [];
        for (const line of block.split("\n")) {
          if (!line || line.startsWith(":")) continue; // blank or keepalive comment
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;

        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
        } catch {
          data = {};
        }
        onEvent(event, data);
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

// Mark the most recent running tool of a given name as completed/failed.
function closeTool(tools: ToolEvent[] | undefined, name: string | undefined, status: ToolStatus, durationMs?: number): ToolEvent[] {
  const next = [...(tools ?? [])];
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i].tool === name && next[i].status === "running") {
      next[i] = { ...next[i], status, durationMs };
      return next;
    }
  }
  return next;
}

// A turn in flight (or just finished). Runs live in a session-keyed registry rather than in the
// React tree, so switching threads never cancels them: the stream keeps consuming in the
// background, and the run's bubbles are re-merged into view when the user returns to the thread.
interface LiveRun {
  /** null until response.created mints a session id (brand-new chat). */
  sessionId: string | null;
  responseId: string | null;
  abort: AbortController;
  /** The `input` actually sent upstream (files-only turns substitute FILES_ONLY_PROMPT) — used
   *  to match this turn against transcript rows; `user.content` stays the display text. */
  input: string;
  user: ChatMessage;
  /** Latest immutable snapshot of the assistant bubble — updated via patchRun. */
  assistant: ChatMessage;
  done: boolean;
  /** Set when `done` flips — lets the merge tell a just-finished run from a long-settled one. */
  finishedAt?: number;
}

// --- Reattach receipts -------------------------------------------------------------------------
// A per-tab sessionStorage note of the turn running on a session, so a page reload (or leaving and
// re-entering the agent workspace) can reattach via GET /v1/responses/{id}/stream — the gateway
// replays every event from response.created onward, then stays live. Receipts are cleaned up when
// a turn is confirmed persisted in the transcript, explicitly stopped, or the replay 404s.

const receiptKey = (agentId: string, sessionId: string) => `a37:chat:run:${agentId}:${sessionId}`;

function rememberRun(agentId: string, sessionId: string, responseId: string, input: string): void {
  try {
    sessionStorage.setItem(receiptKey(agentId, sessionId), JSON.stringify({ id: responseId, input }));
  } catch {
    // Storage unavailable — reattach-after-reload just won't happen.
  }
}

function readReceipt(agentId: string, sessionId: string): { id: string; input: string } | null {
  try {
    const raw = sessionStorage.getItem(receiptKey(agentId, sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: unknown; input?: unknown };
    if (typeof parsed.id !== "string" || !parsed.id) return null;
    return { id: parsed.id, input: typeof parsed.input === "string" ? parsed.input : "" };
  } catch {
    return null;
  }
}

function forgetReceipt(agentId: string, sessionId: string): void {
  try {
    sessionStorage.removeItem(receiptKey(agentId, sessionId));
  } catch {
    // ignore
  }
}

// --- Transcript merging ------------------------------------------------------------------------

function mapHistory(history: SessionDetail["history"]): ChatMessage[] {
  return (history ?? []).map((h) => ({
    id: h.id || uid("h"),
    role: h.role,
    content: h.content ?? "",
    thinking: h.thinking,
  }));
}

function lastUserIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return i;
  }
  return -1;
}

// Does this transcript row hold the turn with this wire input? Exact match, or the input plus
// the "[Attached files: …]" block the gateway appends when files ride along.
function rowMatchesInput(row: ChatMessage, input: string): boolean {
  return input !== "" && (row.content === input || row.content.startsWith(`${input}\n\n[Attached files:`));
}

// How long after a run finishes we still distrust the fetched transcript: a history fetch that
// raced the turn's completion can predate the final answer (multi-step turns persist intermediate
// assistant rows, so "has an assistant row" alone doesn't prove the answer landed).
const SETTLE_MS = 5_000;

// Overlay a live run's bubbles onto the fetched transcript. The run is the session's newest turn,
// and the harness persists its user row at turn start (plus intermediate assistant rows on
// multi-step turns):
// - Transcript's last user row is this turn's → splice the live pair over that tail (the run's
//   assistant bubble carries everything streamed so far, so nothing is double-shown) — unless the
//   run settled long enough ago that the transcript reliably holds the full turn.
// - No match and the run is done → its user row was persisted at turn start, so a non-matching
//   transcript means newer turns exist and already contain this one: keep the transcript as-is
//   rather than re-appending the pair out of order.
// - No match and the run is live → the turn just started; append the live pair.
function mergeLiveRun(history: ChatMessage[], run: LiveRun): ChatMessage[] {
  const idx = lastUserIndex(history);
  const matches = idx !== -1 && rowMatchesInput(history[idx], run.input);
  if (matches) {
    const settled = run.done && Date.now() - (run.finishedAt ?? 0) > SETTLE_MS;
    if (settled && history.slice(idx + 1).some((m) => m.role === "assistant")) return history;
    return [...history.slice(0, idx), run.user, run.assistant];
  }
  if (run.done) return history;
  return [...history, run.user, run.assistant];
}

export function useChat({ agentId, sessionId, onSessionCreated, onActivity }: UseChatArgs) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Turns in flight (or recently finished), keyed by session id. The registry outlives thread
  // switches, so a started response always runs to completion and is re-merged on return.
  const runsRef = useRef<Map<string, LiveRun>>(new Map());
  // The run started from the New Chat view, until response.created mints its session id (or the
  // user leaves the view, which unbinds it — the run itself keeps going).
  const newChatRunRef = useRef<LiveRun | null>(null);
  const activeSessionRef = useRef<string | null>(sessionId);
  // Set just before we promote a freshly-created session, so the load effect doesn't clobber
  // the in-flight stream with a history fetch when `sessionId` flips to the new id.
  const skipLoadRef = useRef<string | null>(null);

  // Latest provider callbacks behind stable refs, so the long-lived stream consumers and the
  // load effect don't churn identity when the provider re-renders (e.g. on tab flips).
  const onSessionCreatedRef = useRef(onSessionCreated);
  onSessionCreatedRef.current = onSessionCreated;
  const onActivityRef = useRef(onActivity);
  onActivityRef.current = onActivity;

  // Whether this run's thread is the one on screen — only then do its patches hit React state.
  const isViewed = useCallback((run: LiveRun) => {
    return run.sessionId ? activeSessionRef.current === run.sessionId : newChatRunRef.current === run;
  }, []);

  // Update a run's assistant snapshot, and mirror it into the visible messages when its thread
  // is on screen. Backgrounded runs just accumulate — re-merged when the user returns.
  const patchRun = useCallback(
    (run: LiveRun, fn: (m: ChatMessage) => ChatMessage) => {
      run.assistant = fn(run.assistant);
      if (!isViewed(run)) return;
      const snapshot = run.assistant;
      setMessages((prev) => {
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].id === snapshot.id) {
            const next = [...prev];
            next[i] = snapshot;
            return next;
          }
        }
        return prev;
      });
    },
    [isViewed]
  );

  // Drop a run everywhere: registry, new-chat binding, and its reattach receipt.
  const forgetRun = useCallback(
    (run: LiveRun) => {
      if (run.sessionId) {
        if (runsRef.current.get(run.sessionId) === run) runsRef.current.delete(run.sessionId);
        forgetReceipt(agentId, run.sessionId);
      }
      if (newChatRunRef.current === run) newChatRunRef.current = null;
    },
    [agentId]
  );

  // Cancel a turn upstream so the agent actually stops working — dropping the local SSE alone
  // does NOT stop server-side generation (only the cancel endpoint does).
  const cancelUpstream = useCallback(
    (rid: string | null) => {
      if (rid) apiFetch(`/api/agents/${agentId}/chat/responses/${rid}/cancel`, { method: "POST" }).catch(() => {});
    },
    [agentId]
  );

  // Drain a turn's SSE stream into its run. Shared by send() and reattach; runs to completion
  // even when the thread is backgrounded — only the on-screen mirroring is gated.
  const consume = useCallback(
    async (run: LiveRun, body: ReadableStream<Uint8Array>) => {
      let streamError: string | null = null;
      let sawTerminal = false;
      try {
        await readSSE(
          body,
          (event, data) => {
            switch (event) {
              case "response.created": {
                run.responseId = str(data.id) ?? run.responseId;
                const sid = str(data.session_id);
                if (!run.sessionId && sid) {
                  // Brand-new chat: file the run under its minted session. Only promote it to
                  // the open thread if the user is still on the New Chat view it started from.
                  run.sessionId = sid;
                  runsRef.current.set(sid, run);
                  const promote = newChatRunRef.current === run;
                  if (promote) {
                    newChatRunRef.current = null;
                    activeSessionRef.current = sid;
                    skipLoadRef.current = sid;
                  }
                  onSessionCreatedRef.current(sid, run.user.content.slice(0, 80), { promote });
                }
                if (run.sessionId && run.responseId) rememberRun(agentId, run.sessionId, run.responseId, run.input);
                break;
              }
              case "response.reasoning.delta": {
                const t = str(data.text);
                if (t) patchRun(run, (m) => ({ ...m, thinking: (m.thinking ?? "") + t }));
                break;
              }
              case "response.output_text.delta": {
                const t = str(data.text);
                if (t) patchRun(run, (m) => ({ ...m, content: m.content + t }));
                break;
              }
              case "response.tool_call.started":
                patchRun(run, (m) => ({
                  ...m,
                  tools: [...(m.tools ?? []), { tool: str(data.tool) ?? "tool", status: "running", label: str(data.label) }],
                }));
                break;
              case "response.tool_call.completed":
                patchRun(run, (m) => ({
                  ...m,
                  tools: closeTool(m.tools, str(data.tool) ?? "tool", "completed", typeof data.duration_ms === "number" ? data.duration_ms : undefined),
                }));
                break;
              case "response.tool_call.failed":
                patchRun(run, (m) => ({ ...m, tools: closeTool(m.tools, str(data.tool) ?? "tool", "error") }));
                break;
              case "response.completed": {
                sawTerminal = true;
                const final = str(data.output_text);
                if (final) patchRun(run, (m) => ({ ...m, content: final }));
                break;
              }
              case "response.failed": {
                sawTerminal = true;
                const err = data.error as { message?: string } | undefined;
                streamError = err?.message || "The agent failed to respond.";
                break;
              }
            }
          },
          run.abort.signal
        );
      } finally {
        run.done = true;
        run.finishedAt = Date.now();
        // Sweep any still-running tool spinners, and put a failure into the bubble itself so it
        // shows wherever the thread is next viewed — covers terminal events and a bare stream-end.
        patchRun(run, (m) => ({
          ...m,
          content: m.content || (streamError ? `_${streamError}_` : ""),
          tools: (m.tools ?? []).map((t) => (t.status === "running" ? { ...t, status: "completed" as const } : t)),
        }));
        if (sawTerminal) {
          // The turn settled, and the harness persists the transcript before the terminal event
          // fires — the receipt has done its job.
          if (run.sessionId) forgetReceipt(agentId, run.sessionId);
        } else if (!run.abort.signal.aborted) {
          // The stream died without a terminal event — the turn may still be running server-side.
          // Drop the in-memory run but keep the receipt: the next visit to the thread reattaches
          // and replays; a turn that actually died 404s there and cleans itself up.
          if (run.sessionId && runsRef.current.get(run.sessionId) === run) runsRef.current.delete(run.sessionId);
          if (newChatRunRef.current === run) newChatRunRef.current = null;
        }
        if (isViewed(run)) {
          setIsStreaming(false);
          if (streamError) setError(streamError);
        }
      }
    },
    [agentId, patchRun, isViewed]
  );

  // Re-pull the transcript for the on-screen thread (used when a reattach turns out to be dead —
  // the answer, if any, lives in the transcript).
  const refreshHistory = useCallback(
    async (sid: string) => {
      try {
        const res = await apiFetch<SessionDetail>(`/api/agents/${agentId}/chat/sessions/${sid}`);
        if (activeSessionRef.current !== sid || runsRef.current.get(sid)) return;
        setMessages(mapHistory(res.history));
        setIsStreaming(false);
      } catch {
        // Leave whatever's on screen.
      }
    },
    [agentId]
  );

  // Reattach to a turn that outlived this component (page reload / workspace re-entry): register
  // a synthetic run and replay its stream. Returns the run so the caller can merge it right away.
  const startReattach = useCallback(
    (sid: string, receipt: { id: string; input: string }): LiveRun => {
      const run: LiveRun = {
        sessionId: sid,
        responseId: receipt.id,
        abort: new AbortController(),
        input: receipt.input,
        user: { id: uid("u"), role: "user", content: receipt.input },
        assistant: { id: uid("a"), role: "assistant", content: "", tools: [] },
        done: false,
      };
      runsRef.current.set(sid, run);
      void (async () => {
        let attached = false;
        try {
          const res = await fetch(`/api/agents/${agentId}/chat/responses/${encodeURIComponent(receipt.id)}/stream`, {
            signal: run.abort.signal,
          });
          if (!res.ok || !res.body) {
            run.done = true;
            run.finishedAt = Date.now();
            if (runsRef.current.get(sid) === run) runsRef.current.delete(sid);
            // Only a 404 means the response record is truly gone (expired, or a gateway
            // restart) — anything else is transient, so keep the receipt for a later retry.
            if (res.status === 404) forgetReceipt(agentId, sid);
            void refreshHistory(sid);
            return;
          }
          attached = true;
          await consume(run, res.body);
        } catch (e) {
          run.done = true;
          run.finishedAt = Date.now();
          if (runsRef.current.get(sid) === run) runsRef.current.delete(sid);
          if ((e as Error).name === "AbortError") return;
          // Keep the receipt — the stream died, not necessarily the turn. If it broke before
          // attaching, nothing streamed into the bubble yet: fall back to the transcript; a
          // mid-replay drop keeps the partial on screen instead (consume already settled it).
          if (!attached) void refreshHistory(sid);
        }
      })();
      return run;
    },
    [agentId, consume, refreshHistory]
  );

  // Stop any turn on a thread, locally and upstream — used when the thread itself is deleted.
  // With no in-memory run (e.g. after a reload), the receipt still carries the response id the
  // cancel needs; cancelling an already-finished response is a no-op 200 upstream.
  const killRun = useCallback(
    (sid: string) => {
      const receipt = readReceipt(agentId, sid);
      forgetReceipt(agentId, sid);
      const run = runsRef.current.get(sid);
      if (run && !run.done) {
        run.done = true;
        run.finishedAt = Date.now();
        run.abort.abort();
        cancelUpstream(run.responseId);
        runsRef.current.delete(sid);
      } else if (!run && receipt) {
        cancelUpstream(receipt.id);
      }
    },
    [agentId, cancelUpstream]
  );

  // Load history when the selected thread changes; reset for a fresh chat. Switching threads no
  // longer cancels an in-flight turn — the run keeps streaming in the background and both answers
  // land; only the explicit Stop button (or deleting the thread) cancels upstream.
  useEffect(() => {
    activeSessionRef.current = sessionId;

    // `null` is both skipLoadRef's "unset" sentinel AND the New Chat sessionId; guard against
    // null so the New Chat transition (sessionId -> null) is NOT swallowed here and falls
    // through to clear messages below.
    if (skipLoadRef.current !== null && skipLoadRef.current === sessionId) {
      skipLoadRef.current = null;
      return; // we just created this session mid-stream — keep the live messages
    }

    // Leaving the New Chat view unbinds any pre-creation run (it keeps going; response.created
    // will file it under its minted session without promoting it).
    newChatRunRef.current = null;
    setError(null);

    if (!sessionId) {
      setMessages([]);
      setIsStreaming(false);
      return;
    }

    const liveNow = runsRef.current.get(sessionId);
    setIsStreaming(!!liveNow && !liveNow.done);

    let cancelled = false;
    setLoadingHistory(true);
    apiFetch<SessionDetail>(`/api/agents/${agentId}/chat/sessions/${sessionId}`)
      .then((res) => {
        if (cancelled) return;
        const history = mapHistory(res.history);

        let run = runsRef.current.get(sessionId) ?? null;
        if (!run) {
          // A receipt without a live run means a turn outlived this component (reload / workspace
          // re-entry). Reattach and replay — the gateway rebuilds finished turns too, and a dead
          // response 404s and cleans the receipt up.
          const receipt = readReceipt(agentId, sessionId);
          if (receipt) run = startReattach(sessionId, receipt);
        }

        if (run) {
          const merged = mergeLiveRun(history, run);
          if (merged === history) forgetRun(run); // finished and fully persisted — transcript wins
          setMessages(merged);
          setIsStreaming(!run.done);
        } else {
          setMessages(history);
          setIsStreaming(false);
        }
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId, sessionId, startReattach, forgetRun]);

  const send = useCallback(
    async (text: string, settings: SendSettings = {}) => {
      const trimmed = text.trim();
      const files = settings.files ?? [];
      if ((!trimmed && files.length === 0) || isStreaming) return;
      setError(null);

      const userMsg: ChatMessage = {
        id: uid("u"),
        role: "user",
        content: trimmed,
        attachments: settings.attachments?.length ? settings.attachments : undefined,
      };
      const assistant: ChatMessage = { id: uid("a"), role: "assistant", content: "", tools: [] };
      setMessages((prev) => [...prev, userMsg, assistant]);
      setIsStreaming(true);

      const run: LiveRun = {
        sessionId: activeSessionRef.current,
        responseId: null,
        abort: new AbortController(),
        // Mirror the BFF's files-only substitution so the run's input matches what the
        // transcript will store; the user bubble keeps the (possibly empty) typed text.
        input: trimmed || FILES_ONLY_PROMPT,
        user: userMsg,
        assistant,
        done: false,
      };
      if (run.sessionId) {
        runsRef.current.set(run.sessionId, run);
        // Bubble an existing thread to the top of the rail as soon as it gets a new turn.
        onActivityRef.current?.(run.sessionId);
      } else {
        newChatRunRef.current = run;
      }

      try {
        const res = await fetch(`/api/agents/${agentId}/chat/responses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: trimmed,
            session_id: run.sessionId ?? undefined,
            model: settings.model ?? undefined,
            provider: settings.provider ?? undefined,
            reasoning_effort: settings.reasoningEffort ?? undefined,
            files: files.length ? files : undefined,
          }),
          signal: run.abort.signal,
        });

        if (!res.ok || !res.body) {
          // A 409 means the previous turn is still wrapping up (session busy) — soften it. The
          // status carries the semantics, so we don't have to match the error text.
          if (res.status === 409) {
            throw new Error("Your agent is still finishing the previous message. Give it a moment and try again.");
          }
          throw new Error(await readApiError(res, "Chat failed"));
        }

        await consume(run, res.body);
      } catch (e) {
        run.done = true;
        run.finishedAt = Date.now();
        const viewed = isViewed(run);
        // Drop the in-memory run but keep any reattach receipt: if only the local stream died
        // (not the turn), revisiting the thread reattaches and replays; a dead turn 404s there
        // and cleans itself up.
        if (run.sessionId && runsRef.current.get(run.sessionId) === run) runsRef.current.delete(run.sessionId);
        if (newChatRunRef.current === run) newChatRunRef.current = null;
        if (viewed) {
          setIsStreaming(false);
          if ((e as Error).name !== "AbortError") setError((e as Error).message || "Something went wrong.");
        }
      }
    },
    [agentId, isStreaming, consume, isViewed]
  );

  // Stop the current turn: abort the local stream and cancel it upstream so the agent stops work.
  const stop = useCallback(() => {
    const run = activeSessionRef.current ? runsRef.current.get(activeSessionRef.current) : newChatRunRef.current;
    if (run && !run.done) {
      run.done = true;
      run.finishedAt = Date.now();
      run.abort.abort();
      cancelUpstream(run.responseId);
      forgetRun(run);
    }
    setIsStreaming(false);
  }, [cancelUpstream, forgetRun]);

  // On unmount, close the local streams only — the turns keep running server-side, and their
  // receipts let the next mount (reload, workspace re-entry) reattach losslessly.
  useEffect(() => {
    const runs = runsRef.current;
    return () => {
      for (const run of runs.values()) run.abort.abort();
      // eslint-disable-next-line react-hooks/exhaustive-deps
      newChatRunRef.current?.abort.abort();
    };
  }, []);

  return { messages, isStreaming, loadingHistory, error, send, stop, killRun };
}
