"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleStop,
  FileText,
  Globe2,
  Hand,
  Loader2,
  MessageSquareText,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, readApiError } from "@/lib/api";
import type { Role, WhatsAppAgentDashboardStatus } from "@/lib/types";
import type { BusinessProfile } from "@/lib/whatsapp-knowledge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PublicKnowledgeSource {
  id: string;
  kind: "text" | "url" | "file";
  label: string;
  mediaType: string;
  status: "processing" | "ready" | "failed";
  provenance: { capturedAt: string; url?: string; filename?: string; byteLength?: number };
  digest: string | null;
  lastError: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
}

interface KnowledgeState {
  profile: BusinessProfile;
  sources: PublicKnowledgeSource[];
  activeVersion: number | null;
  syncedVersion: number | null;
  workflowId: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  previewPrompt: string;
}

const EMPTY_PROFILE: BusinessProfile = {
  businessName: "",
  description: "",
  services: [],
  hours: "",
  serviceAreas: [],
  languages: [],
  tone: "",
  approvedPricingFacts: [],
  faqs: [],
  escalationPolicy: "",
  forbiddenClaims: [],
  ownerNotificationTarget: "",
};

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function statusVariant(status: string | null | undefined) {
  if (["connected", "active", "ready", "waiting", "ended"].includes(status ?? "")) return "success" as const;
  if (["failed", "archived"].includes(status ?? "")) return "destructive" as const;
  return "warning" as const;
}

function Field({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = `whatsapp-profile-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder, rows = 4 }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const id = `whatsapp-profile-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
      />
    </div>
  );
}

export function WhatsAppAgentConsole({ agentId, role }: { agentId: string; role: Role }) {
  const [status, setStatus] = useState<WhatsAppAgentDashboardStatus | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeState | null>(null);
  const [profile, setProfile] = useState<BusinessProfile>(EMPTY_PROFILE);
  const [faqDraft, setFaqDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [tested, setTested] = useState(false);
  const [question, setQuestion] = useState("");
  const [sandbox, setSandbox] = useState<{ answer: string; grounded: boolean; citation: string | null } | null>(null);
  const [textLabel, setTextLabel] = useState("");
  const [textSource, setTextSource] = useState("");
  const [urlSource, setUrlSource] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const isAdmin = role === "admin";

  const load = useCallback(async () => {
    try {
      const [nextStatus, nextKnowledge] = await Promise.all([
        apiFetch<WhatsAppAgentDashboardStatus>(`/api/agents/${agentId}/whatsapp/status`),
        apiFetch<KnowledgeState>(`/api/agents/${agentId}/whatsapp/knowledge`),
      ]);
      setStatus(nextStatus);
      setKnowledge(nextKnowledge);
      setProfile(nextKnowledge.profile);
      setFaqDraft(nextKnowledge.profile.faqs.map((faq) => `${faq.question} | ${faq.answer}`).join("\n"));
      setTested(Boolean(nextStatus.runtime.sandboxTestedAt));
    } catch (error) {
      toast.error((error as Error).message);
    }
  }, [agentId]);

  useEffect(() => {
    setStatus(null);
    setKnowledge(null);
    setTested(false);
    setSandbox(null);
    void load();
  }, [load]);

  const readySources = knowledge?.sources.filter((source) => source.status === "ready").length ?? 0;
  const readiness = useMemo(() => ({
    connection: Boolean(status?.business.connected),
    profile: Boolean(profile.businessName.trim() && profile.description.trim()),
    knowledge: readySources > 0,
    sandbox: tested,
    workflow: Boolean(status?.runtime.provisioned),
    published:
      knowledge?.activeVersion !== null &&
      knowledge?.activeVersion === knowledge?.syncedVersion,
  }), [profile.businessName, profile.description, readySources, status, tested, knowledge]);
  const canEnable = Object.values(readiness).every(Boolean);
  const conversationRows = useMemo(() => {
    const handoffByExecution = new Map(
      (status?.handoffs ?? []).map((handoff) => [handoff.executionId, handoff])
    );
    const rows = (status?.conversations ?? []).map((conversation) => ({
      ...conversation,
      reason: handoffByExecution.get(conversation.executionId)?.reason ?? null,
    }));
    const seen = new Set(rows.map((conversation) => conversation.executionId));
    for (const handoff of status?.handoffs ?? []) {
      if (!seen.has(handoff.executionId)) {
        rows.push({
          executionId: handoff.executionId,
          conversationId: handoff.conversationId,
          status: "handoff",
          reason: handoff.reason,
        });
      }
    }
    return rows;
  }, [status]);

  async function run(label: string, operation: () => Promise<void>) {
    setBusy(label);
    try {
      await operation();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function saveProfile() {
    await run("profile", async () => {
      const nextProfile = {
        ...profile,
        faqs: lines(faqDraft)
          .map((item) => {
            const [question, ...answer] = item.split("|");
            return { question: question.trim(), answer: answer.join("|").trim() };
          })
          .filter((faq) => faq.question && faq.answer),
      };
      const result = await apiFetch<{ profile: BusinessProfile }>(`/api/agents/${agentId}/whatsapp/knowledge`, {
        method: "PUT",
        body: JSON.stringify(nextProfile),
      });
      setProfile(result.profile);
      setTested(false);
      toast.success("Draft profile saved");
      await load();
    });
  }

  async function runtimeAction(action: "provision" | "enable" | "disable") {
    await run(action, async () => {
      await apiFetch(`/api/agents/${agentId}/whatsapp/runtime`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      toast.success(action === "enable" ? "WhatsApp Agent is on" : action === "disable" ? "WhatsApp Agent is off" : "Workflow prepared");
      await load();
    });
  }

  async function publish() {
    await run("publish", async () => {
      const result = await apiFetch<{ version: number; synced: boolean }>(`/api/agents/${agentId}/whatsapp/knowledge`, { method: "POST" });
      toast.success(result.synced ? `Version ${result.version} published and synced` : `Version ${result.version} published`);
      await load();
    });
  }

  async function addText() {
    await run("add-text", async () => {
      await apiFetch(`/api/agents/${agentId}/whatsapp/knowledge/sources`, {
        method: "POST",
        body: JSON.stringify({ kind: "text", label: textLabel || "Pasted text", text: textSource }),
      });
      setTextLabel("");
      setTextSource("");
      setTested(false);
      await load();
    });
  }

  async function addUrl() {
    await run("add-url", async () => {
      await apiFetch(`/api/agents/${agentId}/whatsapp/knowledge/sources`, {
        method: "POST",
        body: JSON.stringify({ kind: "url", url: urlSource }),
      });
      setUrlSource("");
      setTested(false);
      await load();
    });
  }

  async function uploadFile(file: File) {
    await run("upload", async () => {
      const form = new FormData();
      form.set("file", file);
      // Do not set multipart/form-data manually: the browser must add its boundary.
      const response = await fetch(`/api/agents/${agentId}/whatsapp/knowledge/sources`, { method: "POST", body: form });
      if (!response.ok) throw new Error(await readApiError(response, "Upload failed"));
      setTested(false);
      await load();
    });
  }

  async function sourceAction(sourceId: string, action: "resync" | "remove") {
    await run(`${action}-${sourceId}`, async () => {
      await apiFetch(`/api/agents/${agentId}/whatsapp/knowledge/sources/${sourceId}`, {
        method: action === "resync" ? "POST" : "DELETE",
      });
      setTested(false);
      await load();
    });
  }

  async function testAnswer() {
    await run("sandbox", async () => {
      const result = await apiFetch<{ answer: string; grounded: boolean; citation: string | null }>(`/api/agents/${agentId}/whatsapp/sandbox`, {
        method: "POST",
        body: JSON.stringify({ question }),
      });
      setSandbox(result);
      setTested(true);
    });
  }

  async function conversationAction(executionId: string, action: "handoff" | "resume") {
    await run(`${action}-${executionId}`, async () => {
      await apiFetch(`/api/agents/${agentId}/whatsapp/conversations/${executionId}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      toast.success(action === "handoff" ? "Human takeover started" : "Conversation returned to the agent");
      await load();
    });
  }

  if (!status || !knowledge) {
    return <div className="alfi-panel flex min-h-40 items-center justify-center rounded-2xl"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <section className="alfi-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Runtime</h2></div>
            <p className="mt-1 text-sm text-muted-foreground">Kapso answers customers directly. Alfi helps you configure and monitor it.</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Master control</p>
              <p className="text-xs text-muted-foreground">{status.runtime.triggerActive ? "New messages are automated" : "Automation is paused"}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={status.runtime.triggerActive}
              aria-label="Turn WhatsApp Agent on or off"
              disabled={busy !== null || role !== "admin" || (!status.runtime.triggerActive && !canEnable)}
              onClick={() => runtimeAction(status.runtime.triggerActive ? "disable" : "enable")}
              className={`relative h-7 w-12 rounded-full transition ${status.runtime.triggerActive ? "bg-emerald-500" : "bg-slate-300"} disabled:opacity-50`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${status.runtime.triggerActive ? "start-6" : "start-1"}`} />
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Connection", status.business.connected ? status.business.displayNumber || "Connected" : status.business.status],
            ["Workflow", status.runtime.provisioned ? status.runtime.workflowState || "Ready" : "Not prepared"],
            ["Model", status.runtime.model || "Not selected"],
            ["Last run", status.runtime.lastRunStatus || "No runs yet"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-2 truncate text-sm font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(status.business.status)}>Connection: {status.business.status.replaceAll("_", " ")}</Badge>
          <Badge variant={statusVariant(status.runtime.triggerActive ? "active" : "paused")}>Trigger: {status.runtime.triggerActive ? "on" : "off"}</Badge>
          <Badge variant={status.handoffs.length ? "warning" : "success"}>{status.handoffs.length} active handoff{status.handoffs.length === 1 ? "" : "s"}</Badge>
          <span className="text-xs text-muted-foreground">Last sync: {formatDate(status.runtime.lastSyncedAt)}</span>
        </div>
        {status.runtime.lastError && (
          <div className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{status.runtime.lastError}</span></div>
        )}
        {!status.runtime.provisioned && status.business.connected && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => runtimeAction("provision")} disabled={busy !== null || !isAdmin || knowledge.activeVersion === null}><Play />Prepare workflow</Button>
            <span className="text-xs text-muted-foreground">Test and publish the approved draft first.</span>
          </div>
        )}
      </section>

      <section className="alfi-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Agent profile</h2><p className="mt-1 text-sm text-muted-foreground">Draft the approved facts, voice, availability, and escalation boundaries.</p></div>
          <Button onClick={saveProfile} disabled={busy !== null || !isAdmin}><Save />Save draft</Button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Business name" value={profile.businessName} onChange={(businessName) => setProfile({ ...profile, businessName })} />
          <Field label="Tone" value={profile.tone} placeholder="Warm, concise, professional" onChange={(tone) => setProfile({ ...profile, tone })} />
          <TextAreaField label="Business description" value={profile.description} onChange={(description) => setProfile({ ...profile, description })} />
          <TextAreaField label="Services / products" value={profile.services.join("\n")} placeholder="One per line" onChange={(value) => setProfile({ ...profile, services: lines(value) })} />
          <TextAreaField label="Opening hours" value={profile.hours} onChange={(hours) => setProfile({ ...profile, hours })} />
          <TextAreaField label="Service areas" value={profile.serviceAreas.join("\n")} placeholder="One per line" onChange={(value) => setProfile({ ...profile, serviceAreas: lines(value) })} />
          <TextAreaField label="Languages" value={profile.languages.join("\n")} placeholder="One per line" onChange={(value) => setProfile({ ...profile, languages: lines(value) })} />
          <TextAreaField label="Approved pricing facts" value={profile.approvedPricingFacts.join("\n")} placeholder="Only facts the agent may quote" onChange={(value) => setProfile({ ...profile, approvedPricingFacts: lines(value) })} />
          <TextAreaField label="FAQ" value={faqDraft} placeholder="Question | Answer (one per line)" onChange={setFaqDraft} />
          <TextAreaField label="Escalation policy" value={profile.escalationPolicy} onChange={(escalationPolicy) => setProfile({ ...profile, escalationPolicy })} />
          <TextAreaField label="Forbidden claims" value={profile.forbiddenClaims.join("\n")} placeholder="One per line" onChange={(value) => setProfile({ ...profile, forbiddenClaims: lines(value) })} />
          <Field label="Owner notification target" value={profile.ownerNotificationTarget} placeholder="Name, phone, or inbox owner" onChange={(ownerNotificationTarget) => setProfile({ ...profile, ownerNotificationTarget })} />
        </div>
      </section>

      <section className="alfi-panel rounded-2xl p-5 sm:p-6">
        <div><h2 className="text-lg font-semibold">Knowledge sources</h2><p className="mt-1 text-sm text-muted-foreground">This grounds Alfi with approved business information. Supported uploads: text, Markdown, CSV, and JSON up to 1 MB.</p></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="space-y-2 rounded-xl border bg-background p-4"><div className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4" />Paste text</div><Input value={textLabel} onChange={(e) => setTextLabel(e.target.value)} placeholder="Source label" /><textarea rows={4} value={textSource} onChange={(e) => setTextSource(e.target.value)} placeholder="Approved information" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /><Button size="sm" onClick={addText} disabled={busy !== null || !isAdmin || !textSource.trim()}>Add text</Button></div>
          <div className="space-y-2 rounded-xl border bg-background p-4"><div className="flex items-center gap-2 font-medium"><Globe2 className="h-4 w-4" />Website URL</div><Input type="url" value={urlSource} onChange={(e) => setUrlSource(e.target.value)} placeholder="https://example.com/faq" /><Button size="sm" onClick={addUrl} disabled={busy !== null || !isAdmin || !urlSource.trim()}>Import URL</Button></div>
          <div className="space-y-3 rounded-xl border bg-background p-4"><div className="flex items-center gap-2 font-medium"><Upload className="h-4 w-4" />Upload file</div><p className="text-xs text-muted-foreground">Readable text files only. The source and sync status remain visible below.</p><input ref={fileRef} type="file" className="hidden" accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file); event.target.value = ""; }} /><Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy !== null || !isAdmin}><Upload />Choose file</Button></div>
        </div>
        <div className="mt-5 space-y-2">
          {knowledge.sources.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No knowledge sources yet.</p> : knowledge.sources.map((source) => (
            <div key={source.id} className="flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-medium">{source.label}</p><Badge variant={statusVariant(source.status)}>{source.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{source.kind} · synced {formatDate(source.lastSyncedAt)}</p>{source.lastError && <p className="mt-1 text-xs text-red-700">{source.lastError}</p>}</div>
              <div className="flex gap-2">{source.kind === "url" && <Button size="sm" variant="outline" onClick={() => sourceAction(source.id, "resync")} disabled={busy !== null || !isAdmin}><RefreshCw />Re-sync</Button>}<Button size="sm" variant="ghost" onClick={() => sourceAction(source.id, "remove")} disabled={busy !== null || !isAdmin} className="text-destructive"><Trash2 />Remove</Button></div>
            </div>
          ))}
        </div>
      </section>

      <section className="alfi-panel rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Test sandbox</h2></div>
        <p className="mt-1 text-sm text-muted-foreground">Preview an answer from the current draft before publishing. Unknown answers are routed to a person.</p>
        <details className="mt-4 rounded-xl border bg-background p-4"><summary className="cursor-pointer text-sm font-medium">Preview generated agent instructions</summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{knowledge.previewPrompt}</pre></details>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a customer question…" onKeyDown={(event) => { if (event.key === "Enter" && question.trim() && isAdmin) void testAnswer(); }} /><Button onClick={testAnswer} disabled={busy !== null || !isAdmin || !question.trim()}><Send />Test answer</Button></div>
        {sandbox && <div className="mt-4 rounded-xl border bg-background p-4"><div className="flex items-center gap-2">{sandbox.grounded ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}<span className="text-xs font-semibold uppercase tracking-wide">{sandbox.grounded ? "Grounded answer" : "Human handoff"}</span></div><p className="mt-3 text-sm leading-6">{sandbox.answer}</p>{sandbox.citation && <p className="mt-2 text-xs text-muted-foreground">Source: {sandbox.citation}</p>}</div>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4"><div><p className="text-sm font-medium">Draft / preview / publish</p><p className="text-xs text-muted-foreground">Active version {knowledge.activeVersion ?? "—"} · Kapso synced {knowledge.syncedVersion ?? "—"}</p></div><Button onClick={publish} disabled={busy !== null || !isAdmin || !readiness.profile || !readiness.knowledge || !readiness.sandbox}><Upload />Publish update</Button></div>
      </section>

      <section className="alfi-panel rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-2"><Hand className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Human handoffs</h2></div>
        <p className="mt-1 text-sm text-muted-foreground">Take over a live conversation immediately, then return it to the agent when you are ready.</p>
        <div className="mt-4 space-y-2">
          {conversationRows.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No active customer conversations.</p> : conversationRows.map((conversation) => (
            <div key={conversation.executionId} className="flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><p className="text-sm font-medium">{conversation.conversationId || "WhatsApp conversation"}</p><Badge variant={statusVariant(conversation.status)}>{conversation.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Execution {conversation.executionId}</p>{conversation.reason && <p className="mt-1 text-xs text-amber-700">Reason: {conversation.reason}</p>}</div>{conversation.status === "handoff" ? <Button size="sm" onClick={() => conversationAction(conversation.executionId, "resume")} disabled={busy !== null || !isAdmin}><RotateCcw />Return to agent</Button> : <Button size="sm" variant="outline" onClick={() => conversationAction(conversation.executionId, "handoff")} disabled={busy !== null || !isAdmin}><CircleStop />Human takeover</Button>}</div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">CRM changes are never automatic in this MVP. Alfi may collect lead details, but create/update actions require owner approval.</p>
      </section>
    </div>
  );
}
