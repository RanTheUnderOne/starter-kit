"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { LiveTaskRun, Task, TaskMessage, TaskMessagesResponse, TaskResponse, TaskRunResponse, TasksResponse, TaskStatus, ToolProgressEvent } from "@/lib/minions/types";

const basePath = (agentId: string) => `/api/agents/${agentId}/minions`;
const tasksPath = (agentId: string) => `${basePath(agentId)}/tasks`;

export function useTasks(agentId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<TasksResponse>(tasksPath(agentId));
      setTasks(data.tasks);
      setError(null);
    } catch (cause) {
      setError((cause as Error).message || "Couldn't load tasks.");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const events = new EventSource(`${basePath(agentId)}/events`);
    events.onmessage = () => void load();
    return () => events.close();
  }, [agentId, load]);

  const createTask = useCallback(
    async (input: { title?: string; description: string }) => {
      const data = await apiFetch<TaskResponse>(tasksPath(agentId), {
        method: "POST",
        body: JSON.stringify(input),
      });
      await load();
      return data.task;
    },
    [agentId, load]
  );

  const moveTask = useCallback(
    async (task: Task, status: TaskStatus) => {
      const data = await apiFetch<TaskResponse>(`${tasksPath(agentId)}/${encodeURIComponent(task.id)}/move`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await load();
      return data.task;
    },
    [agentId, load]
  );

  const updateTask = useCallback(
    async (task: Task, input: { title?: string; description?: string }) => {
      const data = await apiFetch<TaskResponse>(`${tasksPath(agentId)}/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      await load();
      return data.task;
    },
    [agentId, load]
  );

  const deleteTask = useCallback(
    async (task: Task) => {
      await apiFetch(`${tasksPath(agentId)}/${encodeURIComponent(task.id)}`, { method: "DELETE" });
      await load();
    },
    [agentId, load]
  );

  return { tasks, loading, error, load, createTask, moveTask, updateTask, deleteTask };
}

type LiveEvent =
  | { type: "snapshot"; run: LiveTaskRun }
  | { type: "text_delta"; content?: string }
  | { type: "thinking_delta"; content?: string }
  | { type: "tool_progress"; tool?: string; status?: ToolProgressEvent["status"]; duration?: number; label?: string }
  | { type: "done"; interrupted?: boolean }
  | { type: "error"; error?: string };

export function useTaskRun(agentId: string, taskId: string | null) {
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [working, setWorking] = useState(false);
  const [tools, setTools] = useState<ToolProgressEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const taskPath = taskId ? `${tasksPath(agentId)}/${encodeURIComponent(taskId)}` : null;
  const loadMessages = useCallback(async () => {
    if (!taskPath) return;
    const data = await apiFetch<TaskMessagesResponse>(`${taskPath}/messages`);
    setMessages(data.messages);
  }, [taskPath]);

  useEffect(() => {
    sourceRef.current?.close();
    setMessages([]);
    setTools([]);
    setWorking(false);
    setError(null);
    if (!taskPath) return;
    void loadMessages().catch((cause) => setError((cause as Error).message));
    const source = new EventSource(`${taskPath}/live`);
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as LiveEvent;
        if (event.type === "snapshot") {
          setMessages(event.run.messages);
          setWorking(event.run.status === "streaming");
          setError(event.run.error ?? null);
          const latestAssistant = [...event.run.messages].reverse().find((item) => item.role === "assistant");
          setTools(latestAssistant?.tools ?? []);
        } else if (event.type === "text_delta" && event.content) {
          setMessages((current) => appendAssistantDelta(current, taskId!, event.content!));
        } else if (event.type === "tool_progress") {
          setTools((current) => mergeTool(current, event));
        } else if (event.type === "done") {
          setWorking(false);
          setTools([]);
          void loadMessages();
        } else if (event.type === "error") {
          setWorking(false);
          setError(event.error || "Task failed.");
        }
      } catch { /* Ignore malformed upstream events and keep the stream open. */ }
    };
    sourceRef.current = source;
    return () => source.close();
  }, [loadMessages, taskId, taskPath]);

  const send = useCallback(async (content: string) => {
    if (!taskPath || !taskId) return;
    setError(null);
    setWorking(true);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), task_id: taskId, role: "user", content, created_at: Date.now() },
    ]);
    try {
      await apiFetch<TaskRunResponse>(`${taskPath}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, settings: { mode: "goal" } }),
      });
    } catch (cause) {
      setWorking(false);
      setError(cause instanceof Error ? cause.message : "Couldn't start the task.");
      throw cause;
    }
  }, [taskId, taskPath]);

  const stop = useCallback(async () => {
    if (!taskPath) return;
    await apiFetch(`${taskPath}/interrupt`, { method: "POST" });
  }, [taskPath]);

  return { messages, working, tools, error, send, stop };
}

function appendAssistantDelta(messages: TaskMessage[], taskId: string, content: string) {
  const next = messages.map((message) => ({ ...message }));
  const last = next[next.length - 1];
  if (last?.role === "assistant") last.content += content;
  else next.push({ id: crypto.randomUUID(), task_id: taskId, role: "assistant", content, created_at: Date.now() });
  return next;
}

function mergeTool(current: ToolProgressEvent[], event: Extract<LiveEvent, { type: "tool_progress" }>) {
  const tool: ToolProgressEvent = { tool: event.tool ?? "tool", status: event.status ?? "running", duration: event.duration, label: event.label };
  if (tool.status === "running") return [...current, tool];
  const index = current.findLastIndex((item) => item.tool === tool.tool && item.status === "running");
  return index === -1 ? [...current, tool] : current.map((item, itemIndex) => itemIndex === index ? { ...item, ...tool } : item);
}
