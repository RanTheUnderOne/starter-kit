"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDot, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TASK_STATUSES, type Task, type TaskStatus } from "@/lib/minions/types";
import { useTasks } from "./useTasks";

const columns: { status: TaskStatus; label: string; empty: string }[] = [
  { status: "in_progress", label: "In progress", empty: "No work in progress." },
  { status: "in_review", label: "In review", empty: "Nothing waiting for review." },
  { status: "done", label: "Done", empty: "No completed tasks yet." },
];

export function TasksTab({ agentId }: { agentId: string }) {
  const taskState = useTasks(agentId);
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const grouped = useMemo(
    () => Object.fromEntries(TASK_STATUSES.map((status) => [status, taskState.tasks.filter((task) => task.status === status)])),
    [taskState.tasks]
  ) as Record<TaskStatus, Task[]>;

  return (
    <div className="mx-auto w-full max-w-7xl p-4 md:p-8">
      <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">Plan and track work for this Alfi Agent.</p>
        </div>
        <Button type="button" className="min-h-11 shrink-0" onClick={() => setEditing("new")}>
          <Plus />
          Create task
        </Button>
      </header>

      {taskState.loading && taskState.tasks.length === 0 ? (
        <div className="flex min-h-56 items-center justify-center text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : taskState.error ? (
        <div className="mt-6 rounded-lg bg-destructive/10 p-4 text-sm text-destructive [overflow-wrap:anywhere]">
          {taskState.error}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {columns.map((column) => (
            <section key={column.status} className="min-w-0 rounded-xl border bg-card p-3">
              <div className="mb-3 flex items-center gap-2 px-1"><ColumnIcon status={column.status} /><h2 className="font-medium">{column.label}</h2><span className="text-sm text-muted-foreground">{grouped[column.status].length}</span></div>
              <div className="space-y-3">
                {grouped[column.status].length === 0 ? <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{column.empty}</p> : grouped[column.status].map((task) => (
                  <TaskCard key={task.id} task={task} onEdit={() => setEditing(task)} onDelete={() => setPendingDelete(task)} onMove={(status) => taskState.moveTask(task, status).catch(showError)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <TaskDialog
        open={editing !== null}
        task={editing === "new" ? null : editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={async (input) => {
          if (editing === "new") await taskState.createTask(input);
          else if (editing) await taskState.updateTask(editing, input);
          setEditing(null);
          toast.success(editing === "new" ? "Task created" : "Task updated");
        }}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this task?"
        description={pendingDelete ? `“${pendingDelete.title}” will be permanently deleted.` : undefined}
        confirmText="Delete"
        destructive
        onConfirm={async () => { if (pendingDelete) await taskState.deleteTask(pendingDelete); toast.success("Task deleted"); }}
      />
    </div>
  );
}

function TaskCard({ task, onEdit, onDelete, onMove }: { task: Task; onEdit: () => void; onDelete: () => void; onMove: (status: TaskStatus) => void }) {
  return <article className="min-w-0 rounded-lg border bg-background p-3 shadow-sm">
    <h3 className="font-medium [overflow-wrap:anywhere]">{task.title}</h3>
    {task.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground [overflow-wrap:anywhere]">{task.description}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      {columns.filter((column) => column.status !== task.status).map((column) => <Button key={column.status} type="button" variant="outline" size="sm" className="min-h-11" onClick={() => onMove(column.status)}>Move to {column.label}</Button>)}
      <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onEdit} aria-label={`Edit ${task.title}`}><Pencil /></Button>
      <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11 text-destructive hover:text-destructive" onClick={onDelete} aria-label={`Delete ${task.title}`}><Trash2 /></Button>
    </div>
  </article>;
}

function ColumnIcon({ status }: { status: TaskStatus }) {
  return status === "done" ? <CheckCircle2 className="size-4 text-primary" /> : <CircleDot className={cn("size-4", status === "in_review" && "text-amber-600")} />;
}

function TaskDialog({ open, task, onOpenChange, onSave }: { open: boolean; task: Task | null; onOpenChange: (open: boolean) => void; onSave: (input: { title?: string; description: string }) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
    }
  }, [open, task]);
  async function submit() {
    const cleanDescription = description.trim();
    if (!cleanDescription) return;
    setBusy(true);
    try { await onSave({ title: title.trim() || undefined, description: cleanDescription }); setTitle(""); setDescription(""); } catch (error) { showError(error); } finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={(next) => { if (!busy) { if (!next) { setTitle(""); setDescription(""); } onOpenChange(next); } }}>
    <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{task ? "Edit task" : "Create task"}</DialogTitle></DialogHeader>
      <div className="space-y-3"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task title" aria-label="Task title" /><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What should this task accomplish?" aria-label="Task description" rows={5} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button><Button onClick={submit} disabled={busy || !description.trim()}>{busy ? "Saving..." : task ? "Save changes" : "Create task"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function showError(error: unknown) { toast.error(error instanceof Error ? error.message : "Something went wrong."); }
