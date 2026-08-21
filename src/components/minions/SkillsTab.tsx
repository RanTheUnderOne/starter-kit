"use client";

import { useRef, useState } from "react";
import { Download, FileText, Loader2, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ClawHubSkillSummary, SkillMeta } from "@/lib/minions/types";
import { useSkills } from "./useSkills";

type Mode = "browse" | "installed";
type Content = { title: string; content: string } | null;

export function SkillsTab({ agentId }: { agentId: string }) {
  const skillState = useSkills(agentId);
  const [mode, setMode] = useState<Mode>("browse");
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SkillMeta | null>(null);
  const [content, setContent] = useState<Content>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function inspectInstalled(skill: SkillMeta) {
    setBusyId(`content-${skill.id}`);
    try {
      const result = await skillState.installedContent(skill);
      setContent({ title: skill.name || skill.id, content: result.content });
    } catch (error) { showError(error); } finally { setBusyId(null); }
  }

  async function inspectRegistry(skill: ClawHubSkillSummary) {
    setBusyId(`content-${skill.slug}`);
    try {
      const result = await skillState.registryContent(skill);
      setContent({ title: skill.displayName || skill.slug, content: result.content });
    } catch (error) { showError(error); } finally { setBusyId(null); }
  }

  async function install(skill: ClawHubSkillSummary) {
    setBusyId(`install-${skill.slug}`);
    try {
      const result = await skillState.installSkill(skill);
      toast.success(result.alreadyInstalled ? "Skill is already installed" : "Skill installed");
    } catch (error) { showError(error); } finally { setBusyId(null); }
  }

  async function importFiles(files: FileList | null) {
    const selected = files ? Array.from(files) : [];
    if (!selected.length) return;
    setBusyId("import");
    try { await skillState.importSkills(selected); toast.success("Skill imported"); }
    catch (error) { showError(error); }
    finally { setBusyId(null); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  return <div className="mx-auto w-full max-w-7xl p-4 md:p-8">
    <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold">Skills</h1>
        <p className="mt-1 text-sm text-muted-foreground">Install and manage the capabilities available to this Alfi Agent.</p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <input ref={fileInputRef} className="sr-only" type="file" multiple aria-label="Import skill files" onChange={(event) => void importFiles(event.target.files)} />
        <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" disabled={busyId === "import"} onClick={() => fileInputRef.current?.click()}><Upload />{busyId === "import" ? "Importing..." : "Import skill"}</Button>
      </div>
    </header>

    <div className="mt-4 flex flex-wrap gap-2" aria-label="Skills mode">
      <Button type="button" variant={mode === "browse" ? "default" : "outline"} className="min-h-11" onClick={() => setMode("browse")}>Browse</Button>
      <Button type="button" variant={mode === "installed" ? "default" : "outline"} className="min-h-11" onClick={() => setMode("installed")}>Installed ({skillState.skills.length})</Button>
    </div>

    {mode === "browse" ? <>
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void skillState.loadRegistry(query); }}>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search skills" aria-label="Search skills" className="min-h-11" />
        <Button type="submit" className="min-h-11"><Search />Search</Button>
      </form>
      <RegistryGrid skills={skillState.registrySkills} loading={skillState.registryLoading} busyId={busyId} onInspect={inspectRegistry} onInstall={install} />
    </> : <InstalledGrid skills={skillState.skills} loading={skillState.loading} busyId={busyId} onInspect={inspectInstalled} onDelete={setPendingDelete} />}

    {skillState.error && <p className="mt-4 rounded-lg bg-destructive/10 p-4 text-sm text-destructive [overflow-wrap:anywhere]">{skillState.error}</p>}
    <ContentDialog content={content} onOpenChange={(open) => !open && setContent(null)} />
    <ConfirmDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)} title="Delete this skill?" description={pendingDelete ? `“${pendingDelete.name || pendingDelete.id}” will no longer be available to this agent.` : undefined} confirmText="Delete skill" destructive onConfirm={async () => { if (pendingDelete) { await skillState.deleteSkill(pendingDelete); toast.success("Skill deleted"); } }} />
  </div>;
}

function RegistryGrid({ skills, loading, busyId, onInspect, onInstall }: { skills: ClawHubSkillSummary[]; loading: boolean; busyId: string | null; onInspect: (skill: ClawHubSkillSummary) => void; onInstall: (skill: ClawHubSkillSummary) => void }) {
  if (loading) return <Loading />;
  if (!skills.length) return <Empty message="No registry skills found." />;
  return <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">{skills.map((skill) => <article key={`${skill.ownerHandle ?? ""}/${skill.slug}`} className="min-w-0 rounded-xl border bg-card p-4"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-medium [overflow-wrap:anywhere]">{skill.displayName || skill.slug}</h2><p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{skill.ownerHandle ? `${skill.ownerHandle}/` : ""}{skill.slug}{skill.latestVersion ? ` · ${skill.latestVersion}` : ""}</p></div></div><p className="mt-3 text-sm text-muted-foreground [overflow-wrap:anywhere]">{skill.summary || "No description provided."}</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" className="min-h-11" disabled={busyId === `content-${skill.slug}`} onClick={() => void onInspect(skill)}><FileText />View content</Button><Button type="button" className="min-h-11" disabled={busyId === `install-${skill.slug}`} onClick={() => void onInstall(skill)}><Download />{busyId === `install-${skill.slug}` ? "Installing..." : "Install"}</Button></div></article>)}</div>;
}

function InstalledGrid({ skills, loading, busyId, onInspect, onDelete }: { skills: SkillMeta[]; loading: boolean; busyId: string | null; onInspect: (skill: SkillMeta) => void; onDelete: (skill: SkillMeta) => void }) {
  if (loading) return <Loading />;
  if (!skills.length) return <Empty message="No skills are installed yet. Browse the registry or import a skill." />;
  return <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">{skills.map((skill) => <article key={skill.id} className="min-w-0 rounded-xl border bg-card p-4"><h2 className="font-medium [overflow-wrap:anywhere]">{skill.name || skill.id}</h2><p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{skill.id}{skill.version ? ` · ${skill.version}` : ""}</p><p className="mt-3 text-sm text-muted-foreground [overflow-wrap:anywhere]">{skill.description || "No description provided."}</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" className="min-h-11" disabled={busyId === `content-${skill.id}`} onClick={() => void onInspect(skill)}><FileText />View content</Button><Button type="button" variant="outline" className="min-h-11 text-destructive hover:text-destructive" onClick={() => onDelete(skill)}><Trash2 />Delete</Button></div></article>)}</div>;
}

function ContentDialog({ content, onOpenChange }: { content: Content; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={content !== null} onOpenChange={onOpenChange}><DialogContent className="max-h-[85dvh] max-w-3xl overflow-y-auto p-4 sm:p-6"><DialogHeader><DialogTitle className="[overflow-wrap:anywhere]">{content?.title}</DialogTitle></DialogHeader><pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed [overflow-wrap:anywhere]">{content?.content}</pre></DialogContent></Dialog>;
}

function Loading() { return <div className="flex min-h-56 items-center justify-center text-muted-foreground"><Loader2 className="animate-spin" /></div>; }
function Empty({ message }: { message: string }) { return <p className="mt-5 rounded-lg border border-dashed p-4 text-sm text-muted-foreground [overflow-wrap:anywhere]">{message}</p>; }
function showError(error: unknown) { toast.error(error instanceof Error ? error.message : "Something went wrong."); }
