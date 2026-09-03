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
    <div className="mx-auto w-full max-w-6xl space-y-7 px-4 pb-28 pt-7 sm:px-7 lg:px-10 lg:pb-12 lg:pt-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-teal-700">{t("schedules.eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-teal-950 sm:text-4xl">{t("schedules.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-teal-950/60">{t("schedules.subtitle")}</p>
        </div>
        <Button
          className="h-11 rounded-full bg-teal-900 px-5 text-white shadow-lg shadow-teal-950/10 hover:bg-teal-800"
          onClick={() => { setEditing(null); setEditorOpen(true); }}
        >
          <Plus className="h-4 w-4" /> {t("schedules.add")}
        </Button>
      </header>

      {loading ? (
        <div className="alfi-panel flex min-h-64 items-center justify-center rounded-[28px]">
          <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="alfi-panel rounded-[28px] px-6 py-16 text-center">
          <CalendarClock className="mx-auto h-9 w-9 text-teal-700" />
          <h2 className="mt-4 text-lg font-semibold text-teal-950">{t("schedules.empty")}</h2>
          <p className="mt-1 text-sm text-teal-950/55">{t("schedules.emptyBody")}</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {jobs.map((job) => {
            const open = expanded === job.id;
            const jobRuns = runs[job.id] ?? [];
            return (
              <article key={job.id} className="alfi-panel overflow-hidden rounded-[28px]">
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3.5">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#d9f5e8] text-teal-800">
                        <Sparkles className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold tracking-tight text-teal-950">{job.displayName}</h2>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-teal-950/55">{job.prompt}</p>
                      </div>
                    </div>
                    <Badge variant={statusVariant(job.state)} className="shrink-0 rounded-full">
                      {t(`schedules.status.${job.state === "unknown" ? "scheduled" : job.state}`)}
                    </Badge>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-teal-950/[0.035] p-3 text-xs text-teal-950/65">
                    <div className="flex gap-2"><Clock3 className="h-4 w-4 text-teal-700" /><span><b className="block font-semibold text-teal-950">{t("schedules.next")}</b>{date(job.nextRunAt)}</span></div>
                    <div className="flex gap-2"><CirclePlay className="h-4 w-4 text-teal-700" /><span><b className="block font-semibold text-teal-950">{t("schedules.last")}</b>{date(job.lastRunAt)}</span></div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button size="sm" className="rounded-full bg-teal-900 text-white hover:bg-teal-800" disabled={busyId === job.id} onClick={() => action(job, "run")}>
                      {busyId === job.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {t("schedules.runNow")}
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-full" disabled={busyId === job.id} onClick={() => action(job, job.enabled ? "pause" : "resume")}>
                      {job.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {t(job.enabled ? "schedules.pause" : "schedules.resume")}
                    </Button>
                    <Button size="icon" variant="ghost" className="ms-auto h-8 w-8 rounded-full" onClick={() => { setEditing(job); setEditorOpen(true); }} aria-label={t("common.edit")}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-red-700 hover:text-red-800" onClick={() => setDeleting(job)} aria-label={t("common.delete")}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>

                <button type="button" onClick={() => toggleResults(job)} className="flex w-full items-center justify-between border-t border-teal-950/8 bg-teal-950/[0.018] px-6 py-3 text-sm font-semibold text-teal-900 hover:bg-teal-950/[0.04]">
                  <span>{t("schedules.results")}</span>{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {open && (
                  <div className="space-y-3 border-t border-teal-950/8 bg-[#f8fbf7] p-4 sm:p-5">
                    {loadingRuns === job.id ? (
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-teal-700" />
                    ) : jobRuns.length === 0 ? (
                      <p className="py-4 text-center text-sm text-teal-950/50">{t("schedules.noResults")}</p>
                    ) : jobRuns.map((run) => (
                      <div key={run.id} className={cn("rounded-2xl border bg-white p-4", run.error && "border-red-200") }>
                        <div className="flex items-center justify-between gap-3 text-xs text-teal-950/50">
                          <span>{date(run.finishedAt ?? run.startedAt ?? run.claimedAt)}</span>
                          <span className="font-semibold uppercase tracking-wide">{run.status}</span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-teal-950/75">{run.output || run.error || t("schedules.noResults")}</p>
                        {run.output && (
                          <Button variant="ghost" size="sm" className="mt-3 rounded-full text-teal-800" onClick={() => { prefillComposer(formatCronResultContext(job, run)); onContinue(job, run); }}>
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

