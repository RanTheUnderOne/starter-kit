export const TASK_STATUSES = ["in_progress", "in_review", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const REASONING_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  agent_model: string | null;
  agent_provider: string | null;
  reasoning_effort: ReasoningEffort | null;
  created_at: number;
  updated_at: number;
  last_agent_response_at: number | null;
  last_viewed_at: number | null;
  last_context_used_tokens: number | null;
  last_context_window_tokens: number | null;
}

export interface TaskResponse { task: Task }
export interface TasksResponse { tasks: Task[] }
export interface TaskDeleteResponse { ok: true }

export interface ScheduledTaskOrigin {
  platform?: string | null;
  chat_id?: string | null;
  chat_name?: string | null;
  thread_id?: string | null;
}

export interface ScheduledTaskRepeat {
  times: number | null;
  completed: number;
}

export type ScheduledTaskStatus = "ok" | "error" | "unknown";

export interface ScheduledTask {
  id: string;
  name: string;
  prompt: string | null;
  schedule: Record<string, unknown> | null;
  scheduleDisplay: string | null;
  enabled: boolean;
  state: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: ScheduledTaskStatus | null;
  lastError: string | null;
  lastDeliveryError: string | null;
  model: string | null;
  provider: string | null;
  baseUrl: string | null;
  deliver: string | null;
  origin: ScheduledTaskOrigin | null;
  repeat: ScheduledTaskRepeat | null;
  contextFrom: string[];
  skills: string[];
  workdir: string | null;
  createdAt: string | null;
}

export interface ScheduledTaskInput {
  name?: string;
  prompt: string;
  schedule: string;
  deliver?: string;
  skills?: string[];
  model?: string | null;
  provider?: string | null;
  baseUrl?: string | null;
  workdir?: string | null;
  repeat?: number | null;
  contextFrom?: string | string[] | null;
}

export interface ScheduledTaskRun {
  id: string;
  scheduledTaskId: string;
  ranAt: string | null;
  path: string;
  status: ScheduledTaskStatus;
  preview: string;
}

export interface ScheduledTaskRunContent {
  body: string;
  status: ScheduledTaskStatus;
}

export interface ScheduledTasksResponse { scheduledTasks: ScheduledTask[] }
export interface ScheduledTaskResponse { scheduledTask: ScheduledTask }
export interface ScheduledTaskRunsResponse { runs: ScheduledTaskRun[] }
export interface ScheduledTaskRunContentResponse { content: ScheduledTaskRunContent }

export interface SkillMeta {
  id: string;
  name: string;
  description: string;
  key: string;
  source: string;
  provider?: string;
  registrySlug?: string;
  registryOwnerHandle?: string;
  sourceUrl?: string;
  version?: string;
  installedAt?: string;
}

export interface SkillInstallResult {
  skill: SkillMeta;
  installed: boolean;
  alreadyInstalled?: boolean;
}

export interface SkillsResponse { skills: SkillMeta[] }
export interface SkillContentResponse { content: string }

export interface ClawHubStats {
  installsAllTime?: number;
  downloads?: number;
  installsCurrent?: number;
  stars?: number;
}

export interface ClawHubSkillSummary {
  slug: string;
  ownerHandle?: string | null;
  sourceUrl?: string | null;
  displayName: string;
  summary: string;
  version?: string | null;
  latestVersion?: string | null;
  updatedAt?: number | null;
  stats?: ClawHubStats | null;
}

export interface ClawHubSkillsResponse { skills: ClawHubSkillSummary[] }

export interface ClawHubScanResult {
  security?: {
    status?: string;
    hasWarnings?: boolean;
  };
}
