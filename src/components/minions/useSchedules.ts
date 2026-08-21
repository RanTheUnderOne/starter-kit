"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  ScheduledTask,
  ScheduledTaskInput,
  ScheduledTaskResponse,
  ScheduledTaskRunContentResponse,
  ScheduledTaskRunsResponse,
  ScheduledTasksResponse,
} from "@/lib/minions/types";

const basePath = (agentId: string) => `/api/agents/${agentId}/minions/scheduled-tasks`;
const schedulePath = (agentId: string, id: string) => `${basePath(agentId)}/${encodeURIComponent(id)}`;

export function useSchedules(agentId: string) {
  const [schedules, setSchedules] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ScheduledTasksResponse>(basePath(agentId));
      setSchedules(data.scheduledTasks);
      setError(null);
    } catch (cause) {
      setError(safeError(cause, "Couldn't load schedules."));
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { void load(); }, [load]);

  const createSchedule = useCallback(async (input: ScheduledTaskInput) => {
    const data = await apiFetch<ScheduledTaskResponse>(basePath(agentId), { method: "POST", body: JSON.stringify(input) });
    await load();
    return data.scheduledTask;
  }, [agentId, load]);

  const updateSchedule = useCallback(async (schedule: ScheduledTask, input: ScheduledTaskInput) => {
    const data = await apiFetch<ScheduledTaskResponse>(schedulePath(agentId, schedule.id), { method: "PATCH", body: JSON.stringify(input) });
    await load();
    return data.scheduledTask;
  }, [agentId, load]);

  const pauseSchedule = useCallback(async (schedule: ScheduledTask) => {
    const data = await apiFetch<ScheduledTaskResponse>(`${schedulePath(agentId, schedule.id)}/pause`, { method: "POST" });
    await load();
    return data.scheduledTask;
  }, [agentId, load]);

  const resumeSchedule = useCallback(async (schedule: ScheduledTask) => {
    const data = await apiFetch<ScheduledTaskResponse>(`${schedulePath(agentId, schedule.id)}/resume`, { method: "POST" });
    await load();
    return data.scheduledTask;
  }, [agentId, load]);

  const runSchedule = useCallback(async (schedule: ScheduledTask) => {
    const data = await apiFetch<ScheduledTaskResponse>(`${schedulePath(agentId, schedule.id)}/run`, { method: "POST" });
    await load();
    return data.scheduledTask;
  }, [agentId, load]);

  const deleteSchedule = useCallback(async (schedule: ScheduledTask) => {
    await apiFetch(schedulePath(agentId, schedule.id), { method: "DELETE" });
    await load();
  }, [agentId, load]);

  const loadRuns = useCallback(async (schedule: ScheduledTask) => {
    return apiFetch<ScheduledTaskRunsResponse>(`${schedulePath(agentId, schedule.id)}/runs`);
  }, [agentId]);

  const loadRunContent = useCallback(async (schedule: ScheduledTask, runId: string) => {
    return apiFetch<ScheduledTaskRunContentResponse>(`${schedulePath(agentId, schedule.id)}/runs/${encodeURIComponent(runId)}/content`);
  }, [agentId]);

  return { schedules, loading, error, load, createSchedule, updateSchedule, pauseSchedule, resumeSchedule, runSchedule, deleteSchedule, loadRuns, loadRunContent };
}

function safeError(cause: unknown, fallback: string) {
  const message = cause instanceof Error && cause.message ? cause.message : fallback;
  return message
    .replace(/https?:\/\/\S+/gi, "[internal service]")
    .replace(/(authorization|x-agent37-key)\s*[:=]\s*\S+/gi, "$1: [redacted]");
}
