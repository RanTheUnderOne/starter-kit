"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Task, TaskResponse, TasksResponse, TaskStatus } from "@/lib/minions/types";

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
