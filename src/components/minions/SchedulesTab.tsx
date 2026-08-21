"use client";

import { useEffect, useState } from "react";
import { CirclePause, Clock3, Loader2, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ScheduledTask, ScheduledTaskInput, ScheduledTaskRun, ScheduledTaskRunContent } from "@/lib/minions/types";
import { useSchedules } from "./useSchedules";

export function SchedulesTab({ agentId }: { agentId: string }) {
  const scheduleState = useSchedules(agentId);
  const { loadRunContent, loadRuns } = scheduleState;
  const [editing, setEditing] = useState<ScheduledTask | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ScheduledTask | null>(null);
  const [history, setHistory] = useState<ScheduledTask | null>(null);
  const [runs, setRuns] = useState<ScheduledTaskRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [output, setOutput] = useState<{ run: ScheduledTaskRun; content: ScheduledTaskRunContent } | null>(null);
  const [outputLoading, setOutputLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!history) return;
    let current = true;
    setHistoryLoading(true);
    loadRuns(history)
      .then((data) => { if (current) setRuns(data.runs); })
      .catch(showError)
      .finally(() => { if (current) setHistoryLoading(false); });
    return () => { current = false; };
  }, [history, loadRuns]);

  async function openOutput(run: ScheduledTaskRun) {
    if (!history) return;
    setOutputLoading(run.id);
    try {
      const data = await loadRunContent(history, run.id);
      setOutput({ run, content: data.content });
    } catch (error) {
      showError(error);
    } finally {
      setOutputLoading(null);
    }
  }

  return <div className="mx-auto w-full max-w-6xl p-4 md:p-8">
    <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0"><h1 className="text-xl font-semibold">Schedules</h1><p className="mt-1 text-sm text-muted-foreground">Run repeatable work for this Alfi Agent.</p></div>
      <Button type="button" className="min-h-11 shrink-0" onClick={() => setEditing("new")}><Plus />Create schedule</Button>
    </header>
    {scheduleState.loading && scheduleState.schedules.length === 0 ? <div className="flex min-h-56 items-center justify-center text-muted-foreground"><Loader2 className="animate-spin" /></div>
      : scheduleState.error ? <div className="mt-6 rounded-lg bg-destructive/10 p-4 text-sm text-destructive [overflow-wrap:anywhere]">{scheduleState.error}</div>
      : <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {scheduleState.schedules.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No schedules yet. Create one to automate recurring work.</p>
            : scheduleState.schedules.map((schedule) => <ScheduleCard key={schedule.id} schedule={schedule} onEdit={() => setEditing(schedule)} onDelete={() => setPendingDelete(schedule)} onHistory={() => setHistory(schedule)} onPause={() => scheduleState.pauseSchedule(schedule).then(() => toast.success("Schedule paused")).catch(showError)} onResume={() => scheduleState.resumeSchedule(schedule).then(() => toast.success("Schedule resumed")).catch(showError)} onRun={() => scheduleState.runSchedule(schedule).then(() => toast.success("Schedule started")).catch(showError)} />)}
        </div>}
    <ScheduleDialog open={editing !== null} schedule={editing === "new" ? null : editing} onOpenChange={(open) => !open && setEditing(null)} onSave={async (input) => { if (editing === "new") await scheduleState.createSchedule(input); else if (editing) await scheduleState.updateSchedule(editing, input); setEditing(null); toast.success(editing === "new" ? "Schedule created" : "Schedule updated"); }} />
    <ConfirmDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)} title="Delete this schedule?" description={pendingDelete ? `“${pendingDelete.name}” and its history will be permanently deleted.` : undefined} confirmText="Delete" destructive onConfirm={async () => { if (pendingDelete) await scheduleState.deleteSchedule(pendingDelete); toast.success("Schedule deleted"); }} />
    <HistoryDialog open={history !== null} schedule={history} runs={runs} loading={historyLoading} outputLoading={outputLoading} onOpenChange={(open) => !open && setHistory(null)} onOutput={openOutput} />
    <OutputDialog output={output} onOpenChange={(open) => !open && setOutput(null)} />
  </div>;
}

function ScheduleCard({ schedule, onEdit, onDelete, onHistory, onPause, onResume, onRun }: { schedule: ScheduledTask; onEdit: () => void; onDelete: () => void; onHistory: () => void; onPause: () => void; onResume: () => void; onRun: () => void }) {
  const status = schedule.lastStatus === "error" ? "destructive" : schedule.enabled ? "success" : "muted";
  return <article className="min-w-0 rounded-xl border bg-card p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h2 className="font-medium [overflow-wrap:anywhere]">{schedule.name}</h2><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground [overflow-wrap:anywhere]">{schedule.prompt || "No prompt supplied."}</p></div><Badge variant={status}>{schedule.enabled ? schedule.lastStatus === "error" ? "Needs attention" : "Enabled" : "Paused"}</Badge></div>
    <dl className="mt-4 space-y-2 rounded-lg bg-muted/40 p-3 text-sm"><Info label="Schedule" value={schedule.scheduleDisplay || formatSchedule(schedule.schedule)} /><Info label="State" value={schedule.state || (schedule.enabled ? "active" : "paused")} /><Info label="Next run" value={formatTimestamp(schedule.nextRunAt)} /><Info label="Last run" value={formatTimestamp(schedule.lastRunAt)} /><Info label="Last status" value={schedule.lastStatus || "unknown"} />{schedule.lastError && <Info label="Last error" value={schedule.lastError} destructive />}</dl>
    <div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" className="min-h-11" onClick={schedule.enabled ? onPause : onResume}>{schedule.enabled ? <CirclePause /> : <Play />}{schedule.enabled ? "Pause" : "Resume"}</Button><Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onRun}><Play />Run now</Button><Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onHistory}><Clock3 />Run history</Button><Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onEdit} aria-label={`Edit ${schedule.name}`}><Pencil /></Button><Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11 text-destructive hover:text-destructive" onClick={onDelete} aria-label={`Delete ${schedule.name}`}><Trash2 /></Button></div>
  </article>;
}

function Info({ label, value, destructive = false }: { label: string; value: string; destructive?: boolean }) { return <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2"><dt className="text-muted-foreground">{label}</dt><dd className={destructive ? "text-destructive [overflow-wrap:anywhere]" : "[overflow-wrap:anywhere]"}>{value}</dd></div>; }

function ScheduleDialog({ open, schedule, onOpenChange, onSave }: { open: boolean; schedule: ScheduledTask | null; onOpenChange: (open: boolean) => void; onSave: (input: ScheduledTaskInput) => Promise<void> }) {
  const [name, setName] = useState(""); const [prompt, setPrompt] = useState(""); const [scheduleText, setScheduleText] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setName(schedule?.name ?? ""); setPrompt(schedule?.prompt ?? ""); setScheduleText(schedule?.scheduleDisplay || formatSchedule(schedule?.schedule)); } }, [open, schedule]);
  async function submit() { const cleanPrompt = prompt.trim(); const cleanSchedule = scheduleText.trim(); if (!cleanPrompt || !cleanSchedule) return; setBusy(true); try { await onSave({ name: name.trim() || undefined, prompt: cleanPrompt, schedule: cleanSchedule }); } catch (error) { showError(error); } finally { setBusy(false); } }
  return <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{schedule ? "Edit schedule" : "Create schedule"}</DialogTitle></DialogHeader><div className="space-y-3"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Schedule name" aria-label="Schedule name" /><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="What should the agent do?" aria-label="Schedule prompt" rows={5} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /><Input value={scheduleText} onChange={(event) => setScheduleText(event.target.value)} placeholder="e.g. every day at 09:00" aria-label="Schedule expression" /><p className="text-xs text-muted-foreground">Use a natural-language schedule such as “every weekday at 09:00”. The agent validates it when saved.</p></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button><Button onClick={submit} disabled={busy || !prompt.trim() || !scheduleText.trim()}>{busy ? "Saving..." : schedule ? "Save changes" : "Create schedule"}</Button></DialogFooter></DialogContent></Dialog>;
}

function HistoryDialog({ open, schedule, runs, loading, outputLoading, onOpenChange, onOutput }: { open: boolean; schedule: ScheduledTask | null; runs: ScheduledTaskRun[]; loading: boolean; outputLoading: string | null; onOpenChange: (open: boolean) => void; onOutput: (run: ScheduledTaskRun) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Run history{schedule ? `: ${schedule.name}` : ""}</DialogTitle></DialogHeader>{loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div> : runs.length === 0 ? <p className="text-sm text-muted-foreground">No runs recorded yet.</p> : <div className="space-y-3">{runs.map((run) => <div key={run.id} className="min-w-0 rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><p className="font-medium">{formatTimestamp(run.ranAt)}</p><p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{run.preview || "No preview available."}</p></div><Badge variant={run.status === "error" ? "destructive" : run.status === "ok" ? "success" : "muted"}>{run.status}</Badge></div><Button type="button" variant="outline" size="sm" className="mt-3 min-h-11" disabled={outputLoading === run.id} onClick={() => onOutput(run)}>{outputLoading === run.id ? "Loading..." : "Output"}</Button></div>)}</div>}</DialogContent></Dialog>;
}

function OutputDialog({ output, onOpenChange }: { output: { run: ScheduledTaskRun; content: ScheduledTaskRunContent } | null; onOpenChange: (open: boolean) => void }) { return <Dialog open={output !== null} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Output</DialogTitle></DialogHeader><pre className="max-w-full whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs [overflow-wrap:anywhere]">{output?.content.body}</pre></DialogContent></Dialog>; }

function formatTimestamp(value: string | null | undefined) { if (!value) return "Not scheduled"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); }
function formatSchedule(value: Record<string, unknown> | null | undefined) { if (!value) return "Not configured"; try { return JSON.stringify(value); } catch { return "Configured"; } }
function showError(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  toast.error(message.replace(/https?:\/\/\S+/gi, "[internal service]").replace(/(authorization|x-agent37-key)\s*[:=]\s*\S+/gi, "$1: [redacted]"));
}
