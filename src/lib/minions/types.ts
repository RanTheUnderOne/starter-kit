export type TaskStatus = "in_progress" | "in_review" | "done";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface SkillMeta {
  id: string;
  name: string;
  description?: string;
  source?: string;
  installedAt?: string;
  [key: string]: unknown;
}

export interface ClawHubSkillSummary {
  slug: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

export interface ScheduledTaskInput {
  title: string;
  prompt: string;
  schedule: string;
  timezone?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface ScheduledTask extends ScheduledTaskInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string | null;
  [key: string]: unknown;
}

export interface ScheduledTaskRun {
  id: string;
  scheduledTaskId: string;
  status: "pending" | "running" | "completed" | "failed" | string;
  startedAt?: string | null;
  completedAt?: string | null;
  [key: string]: unknown;
}

export interface TasksResponse {
  tasks: Task[];
}

export interface SkillsResponse {
  skills: SkillMeta[];
}

export interface ScheduledTasksResponse {
  scheduledTasks: ScheduledTask[];
}

export interface ScheduledTaskRunsResponse {
  runs: ScheduledTaskRun[];
}
