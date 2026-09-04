"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  CirclePlay,
  Clock3,
  Loader2,
  MessageSquareText,
  Pause,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { CronJob, CronJobInput, CronRun } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { useChatContext } from "@/components/chat/ChatProvider";
import { formatCronResultContext } from "@/lib/cron-result-context";
import { ScheduleEditor } from "@/components/ScheduleEditor";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TabHeader } from "@/components/TabHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function statusVariant(state: CronJob["state"]): "success" | "warning" | "destructive" | "muted" {
  if (state === "error") return "destructive";
  if (state === "paused") return "muted";
  if (state === "running") return "warning";
  return "success";
}

export function SchedulesTab({
  agentId,
  onContinue,
}: {
  agentId: string;
  onContinue: (job: CronJob, run: CronRun) => void;
}) {
  const { locale, t } = useLocale();
  const { prefillComposer } = useChatContext();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CronJob | null>(null);
  const [deleting, setDeleting] = useState<CronJob | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, CronRun[]>>({});
  const [loadingRuns, setLoadingRuns] = useState<string | null>(null);

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-IL", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Jerusalem",
    }),
    [locale],
  );

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ jobs: CronJob[] }>(`/api/agents/${agentId}/cron`);
      setJobs(data.jobs);
    } catch (error) {
      toast.error((error as Error).message || t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [agentId, t]);

  useEffect(() => { void load(); }, [load]);

  async function loadRuns(jobId: string, force = false) {
    if (!force && runs[jobId]) return;
    setLoadingRuns(jobId);
    try {
      const data = await apiFetch<{ runs: CronRun[] }>(`/api/agents/${agentId}/cron/${jobId}/runs`);
      setRuns((current) => ({ ...current, [jobId]: data.runs }));
    } catch (error) {
      toast.error((error as Error).message || t("common.error"));
    } finally {
      setLoadingRuns(null);
    }
  }

  async function toggleResults(job: CronJob) {
    const next = expanded === job.id ? null : job.id;
    setExpanded(next);
    if (next) await loadRuns(job.id);
  }

  async function save(input: CronJobInput) {
    setBusyId(editing?.id ?? "create");
    try {
      const endpoint = editing
        ? `/api/agents/${agentId}/cron/${editing.id}`
        : `/api/agents/${agentId}/cron`;
      const data = await apiFetch<{ jobs: CronJob[] }>(endpoint, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(input),
      });
      setJobs(data.jobs);
      setEditorOpen(false);
      setEditing(null);
      toast.success(initialSuccess(editing, locale));
    } catch (error) {
      toast.error((error as Error).message || t("common.error"));
    } finally {
      setBusyId(null);
    }
  }

  async function action(job: CronJob, actionName: "pause" | "resume" | "run") {
    setBusyId(job.id);
    try {
      await apiFetch(`/api/agents/${agentId}/cron/${job.id}/action`, {
        method: "POST",
        body: JSON.stringify({ action: actionName }),
      });
      await load();
      if (actionName === "run") {
        toast.success(locale === "he" ? "אלפי התחיל לעבוד" : "Alfi started the job");
        setExpanded(job.id);
        window.setTimeout(() => void loadRuns(job.id, true), 1800);
      }
    } catch (error) {
      toast.error((error as Error).message || t("common.error"));
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await apiFetch(`/api/agents/${agentId}/cron/${deleting.id}`, { method: "DELETE" });
      setJobs((current) => current.filter((job) => job.id !== deleting.id));
      setDeleting(null);
    } finally {
      setBusyId(null);
    }
  }

  const date = (value: string | null) => value ? formatter.format(new Date(value)) : t("schedules.never");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 px-4 pt-7 sm:px-7 lg:px-10 lg:pt-10">
      <TabHeader
        eyebrow={t("schedules.eyebrow")}
        title={t("schedules.title")}
        subtitle={t("schedules.subtitle")}
        actions={
          <Button
            className="h-10 rounded-lg px-4"
            onClick={() => { setEditing(null); setEditorOpen(true); }}
          >
            <Plus className="h-4 w-4" /> {t("schedules.add")}
          </Button>
        }
      />

      {loading ? (
        <div className="alfi-panel flex min-h-64 items-center justify-center rounded-2xl">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="alfi-panel rounded-2xl px-6 py-16 text-center">
          <CalendarClock className="mx-auto h-9 w-9 text-primary" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">{t("schedules.empty")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("schedules.emptyBody")}</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {jobs.map((job) => {
            const open = expanded === job.id;
            const jobRuns = runs[job.id] ?? [];
            return (
              <article key={job.id} className="alfi-panel overflow-hidden rounded-2xl">
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3.5">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                        <Sparkles className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">{job.displayName}</h2>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{job.prompt}</p>
                      </div>
                    </div>
                    <Badge variant={statusVariant(job.state)} className="shrink-0 rounded-full">
                      {t(`schedules.status.${job.state === "unknown" ? "scheduled" : job.state}`)}
                    </Badge>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                    <div className="flex gap-2"><Clock3 className="h-4 w-4 text-primary" /><span><b className="block font-semibold text-foreground">{t("schedules.next")}</b>{date(job.nextRunAt)}</span></div>
                    <div className="flex gap-2"><CirclePlay className="h-4 w-4 text-primary" /><span><b className="block font-semibold text-foreground">{t("schedules.last")}</b>{date(job.lastRunAt)}</span></div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button size="sm" className="rounded-lg" disabled={busyId === job.id} onClick={() => action(job, "run")}>
                      {busyId === job.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {t("schedules.runNow")}
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-lg" disabled={busyId === job.id} onClick={() => action(job, job.enabled ? "pause" : "resume")}>
                      {job.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {t(job.enabled ? "schedules.pause" : "schedules.resume")}
                    </Button>
                    <Button size="icon" variant="ghost" className="ms-auto h-8 w-8 rounded-lg" onClick={() => { setEditing(job); setEditorOpen(true); }} aria-label={t("common.edit")}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive" onClick={() => setDeleting(job)} aria-label={t("common.delete")}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>

                <button type="button" onClick={() => toggleResults(job)} className="flex w-full items-center justify-between border-t border-border/60 bg-muted/30 px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted/50">
                  <span>{t("schedules.results")}</span>{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {open && (
                  <div className="space-y-3 border-t border-border/60 bg-muted/20 p-4 sm:p-5">
                    {loadingRuns === job.id ? (
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                    ) : jobRuns.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">{t("schedules.noResults")}</p>
                    ) : jobRuns.map((run) => (
                      <div key={run.id} className={cn("rounded-xl border bg-card p-4", run.error && "border-destructive/40") }>
                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>{date(run.finishedAt ?? run.startedAt ?? run.claimedAt)}</span>
                          <span className="font-semibold uppercase tracking-wide">{run.status}</span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{run.output || run.error || t("schedules.noResults")}</p>
                        {run.output && (
                          <Button variant="ghost" size="sm" className="mt-3 rounded-lg text-primary" onClick={() => { prefillComposer(formatCronResultContext(job, run)); onContinue(job, run); }}>
                            <MessageSquareText className="h-4 w-4" /> {t("schedules.continue")}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <ScheduleEditor open={editorOpen} onOpenChange={(value) => { setEditorOpen(value); if (!value) setEditing(null); }} initial={editing} busy={busyId !== null} onSave={save} />
      <ConfirmDialog open={Boolean(deleting)} onOpenChange={(value) => !value && setDeleting(null)} title={t("common.delete")} description={deleting?.displayName ?? ""} confirmText={t("common.delete")} destructive onConfirm={remove} />
    </div>
  );
}

function initialSuccess(editing: CronJob | null, locale: "en" | "he") {
  if (locale === "he") return editing ? "המשימה עודכנה" : "המשימה נוצרה";
  return editing ? "Schedule updated" : "Schedule created";
}

