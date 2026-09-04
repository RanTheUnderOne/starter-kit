import type { DB } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { kapso } from "@/lib/kapso";
import {
  compileKnowledgePrompt,
  deployKnowledgeSnapshot,
  extractUploadedKnowledge,
  extractUrlKnowledge,
  MAX_KNOWLEDGE_FILE_BYTES,
  nextKnowledgeVersion,
  normalizeBusinessProfile,
  refreshKnowledgeSource,
  refreshKnowledgeWorkflow,
  type BusinessProfile,
  type KnowledgeSnapshot,
  type KnowledgeSource,
  type WorkflowDefinition,
} from "@/lib/whatsapp-knowledge";

const EMPTY_PROFILE = normalizeBusinessProfile({});

interface ProfileRow {
  business_name: string;
  description: string;
  services: string[];
  hours: string;
  service_areas: string[];
  languages: string[];
  tone: string;
  approved_pricing_facts: string[];
  faqs: BusinessProfile["faqs"];
  escalation_policy: string;
  forbidden_claims: string[];
  owner_notification_target: string;
}

interface SourceRow {
  id: string;
  source_kind: KnowledgeSource["kind"];
  label: string;
  media_type: string;
  content: string | null;
  content_digest: string | null;
  provenance: KnowledgeSource["provenance"];
  status: "processing" | "ready" | "failed" | "removed";
  last_error: string | null;
  last_synced_at: string | null;
  created_at: string;
}

interface KnowledgeConnectionRow {
  active_knowledge_version: number | null;
  synced_knowledge_version: number | null;
  knowledge_last_synced_at: string | null;
  knowledge_last_error: string | null;
  kapso_workflow_id: string | null;
}

function dbFailure(error: { message?: string } | null, fallback: string) {
  if (error) throw new ApiError(500, "database_error", error.message ?? fallback);
}

async function invalidateSandbox(db: DB, agent37Id: string, workspaceId: string) {
  const { error } = await db
    .from("agent_whatsapp_connections")
    .update({ sandbox_tested_at: null, updated_at: new Date().toISOString() })
    .eq("agent37_id", agent37Id)
    .eq("workspace_id", workspaceId);
  dbFailure(error, "Could not invalidate the previous sandbox test");
}

function profileFromRow(row: ProfileRow | null): BusinessProfile {
  if (!row) return { ...EMPTY_PROFILE };
  return normalizeBusinessProfile({
    businessName: row.business_name,
    description: row.description,
    services: row.services,
    hours: row.hours,
    serviceAreas: row.service_areas,
    languages: row.languages,
    tone: row.tone,
    approvedPricingFacts: row.approved_pricing_facts,
    faqs: row.faqs,
    escalationPolicy: row.escalation_policy,
    forbiddenClaims: row.forbidden_claims,
    ownerNotificationTarget: row.owner_notification_target,
  });
}

function sourceFromRow(row: SourceRow): KnowledgeSource | null {
  if (row.status !== "ready" || !row.content || !row.content_digest) return null;
  return {
    id: row.id,
    kind: row.source_kind,
    label: row.label,
    mediaType: row.media_type,
    text: row.content,
    digest: row.content_digest,
    provenance: row.provenance,
  };
}

export async function getKnowledgeState(db: DB, agent37Id: string) {
  const [profileResult, sourceResult, connectionResult] = await Promise.all([
    db.from("agent_whatsapp_profiles").select("*").eq("agent37_id", agent37Id).maybeSingle(),
    db
      .from("agent_whatsapp_knowledge_sources")
      .select("*")
      .eq("agent37_id", agent37Id)
      .neq("status", "removed")
      .order("created_at", { ascending: true }),
    db
      .from("agent_whatsapp_connections")
      .select(
        "active_knowledge_version,synced_knowledge_version,knowledge_last_synced_at,knowledge_last_error,kapso_workflow_id"
      )
      .eq("agent37_id", agent37Id)
      .maybeSingle(),
  ]);
  dbFailure(profileResult.error, "Could not load WhatsApp Agent profile");
  dbFailure(sourceResult.error, "Could not load knowledge sources");
  dbFailure(connectionResult.error, "Could not load knowledge version");
  const profile = profileFromRow(profileResult.data as ProfileRow | null);
  const rows = (sourceResult.data ?? []) as SourceRow[];
  const connection = connectionResult.data as KnowledgeConnectionRow | null;
  return {
    profile,
    sources: rows.map((row) => ({
      id: row.id,
      kind: row.source_kind,
      label: row.label,
      mediaType: row.media_type,
      status: row.status,
      provenance: row.provenance,
      digest: row.content_digest,
      lastError: row.last_error,
      lastSyncedAt: row.last_synced_at,
      createdAt: row.created_at,
    })),
    readySources: rows.map(sourceFromRow).filter((source): source is KnowledgeSource => Boolean(source)),
    activeVersion: connection?.active_knowledge_version ?? null,
    syncedVersion: connection?.synced_knowledge_version ?? null,
    workflowId: connection?.kapso_workflow_id ?? null,
    lastSyncedAt: connection?.knowledge_last_synced_at ?? null,
    lastError: connection?.knowledge_last_error ?? null,
  };
}

export async function saveKnowledgeProfile(
  db: DB,
  agent37Id: string,
  workspaceId: string,
  input: Partial<BusinessProfile>
) {
  const profile = normalizeBusinessProfile(input);
  const { error } = await db.from("agent_whatsapp_profiles").upsert(
    {
      agent37_id: agent37Id,
      workspace_id: workspaceId,
      business_name: profile.businessName,
      description: profile.description,
      services: profile.services,
      hours: profile.hours,
      service_areas: profile.serviceAreas,
      languages: profile.languages,
      tone: profile.tone,
      approved_pricing_facts: profile.approvedPricingFacts,
      faqs: profile.faqs,
      escalation_policy: profile.escalationPolicy,
      forbidden_claims: profile.forbiddenClaims,
      owner_notification_target: profile.ownerNotificationTarget,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "agent37_id" }
  );
  dbFailure(error, "Could not save WhatsApp Agent profile");
  await invalidateSandbox(db, agent37Id, workspaceId);
  return profile;
}

async function persistSource(db: DB, agent37Id: string, workspaceId: string, source: KnowledgeSource) {
  const payload = {
    agent37_id: agent37Id,
    workspace_id: workspaceId,
    source_kind: source.kind,
    label: source.label,
    media_type: source.mediaType,
    source_url: source.provenance.url ?? null,
    content: source.text,
    content_digest: source.digest,
    provenance: source.provenance,
    status: "ready",
    last_error: null,
    last_synced_at: source.provenance.capturedAt,
    updated_at: new Date().toISOString(),
  };
  const result = await db
    .from("agent_whatsapp_knowledge_sources")
    .insert(payload)
    .select("*")
    .single();
  if (result.error?.code === "23505") {
    const existing = await db
      .from("agent_whatsapp_knowledge_sources")
      .select("*")
      .eq("agent37_id", agent37Id)
      .eq("content_digest", source.digest)
      .neq("status", "removed")
      .single();
    dbFailure(existing.error, "Could not load existing knowledge source");
    return existing.data as SourceRow;
  }
  dbFailure(result.error, "Could not save knowledge source");
  return result.data as SourceRow;
}

export async function addTextKnowledge(
  db: DB,
  agent37Id: string,
  workspaceId: string,
  label: string,
  text: string
) {
  await invalidateSandbox(db, agent37Id, workspaceId);
  return persistSource(
    db,
    agent37Id,
    workspaceId,
    await extractUploadedKnowledge({
      name: label || "Pasted text",
      type: "text/plain",
      bytes: new TextEncoder().encode(text),
    }).then((source) => ({ ...source, kind: "text" as const }))
  );
}

async function ingestTrackedSource(
  db: DB,
  agent37Id: string,
  workspaceId: string,
  draft: { kind: "url" | "file"; label: string; mediaType: string; sourceUrl?: string },
  extract: () => Promise<KnowledgeSource>
) {
  const now = new Date().toISOString();
  const started = await db
    .from("agent_whatsapp_knowledge_sources")
    .insert({
      agent37_id: agent37Id,
      workspace_id: workspaceId,
      source_kind: draft.kind,
      label: draft.label.slice(0, 255),
      media_type: draft.mediaType,
      source_url: draft.sourceUrl ?? null,
      provenance: { capturedAt: now, ...(draft.sourceUrl ? { url: draft.sourceUrl } : {}) },
      status: "processing",
      updated_at: now,
    })
    .select("*")
    .single();
  dbFailure(started.error, "Could not start knowledge source processing");
  await invalidateSandbox(db, agent37Id, workspaceId);
  const sourceId = (started.data as SourceRow).id;

  try {
    const source = await extract();
    const completed = await db
      .from("agent_whatsapp_knowledge_sources")
      .update({
        label: source.label,
        media_type: source.mediaType,
        source_url: source.provenance.url ?? null,
        content: source.text,
        content_digest: source.digest,
        provenance: source.provenance,
        status: "ready",
        last_error: null,
        last_synced_at: source.provenance.capturedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sourceId)
      .eq("agent37_id", agent37Id)
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();
    if (completed.error?.code === "23505") {
      await db
        .from("agent_whatsapp_knowledge_sources")
        .update({ status: "removed", updated_at: new Date().toISOString() })
        .eq("id", sourceId)
        .eq("agent37_id", agent37Id)
        .eq("workspace_id", workspaceId);
      const existing = await db
        .from("agent_whatsapp_knowledge_sources")
        .select("*")
        .eq("agent37_id", agent37Id)
        .eq("content_digest", source.digest)
        .eq("status", "ready")
        .single();
      dbFailure(existing.error, "Could not load existing knowledge source");
      return existing.data as SourceRow;
    }
    dbFailure(completed.error, "Could not finish knowledge source processing");
    return completed.data as SourceRow;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Knowledge source processing failed";
    const failed = await db
      .from("agent_whatsapp_knowledge_sources")
      .update({ status: "failed", last_error: message.slice(0, 2_000), updated_at: new Date().toISOString() })
      .eq("id", sourceId)
      .eq("agent37_id", agent37Id)
      .eq("workspace_id", workspaceId);
    dbFailure(failed.error, "Could not record knowledge source processing failure");
    throw error;
  }
}

export async function addFileKnowledge(
  db: DB,
  agent37Id: string,
  workspaceId: string,
  file: File
) {
  return ingestTrackedSource(
    db,
    agent37Id,
    workspaceId,
    { kind: "file", label: file.name || "Upload", mediaType: file.type || "application/octet-stream" },
    async () =>
      extractUploadedKnowledge({
        name: file.name,
        type: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })
  );
}

export async function addUrlKnowledge(db: DB, agent37Id: string, workspaceId: string, url: string) {
  return ingestTrackedSource(
    db,
    agent37Id,
    workspaceId,
    { kind: "url", label: "Website URL", mediaType: "text/html", sourceUrl: url },
    () => extractUrlKnowledge(url)
  );
}

export async function removeKnowledgeSource(db: DB, agent37Id: string, sourceId: string) {
  const { data, error } = await db
    .from("agent_whatsapp_knowledge_sources")
    .update({ status: "removed", updated_at: new Date().toISOString() })
    .eq("id", sourceId)
    .eq("agent37_id", agent37Id)
    .neq("status", "removed")
    .select("id,workspace_id")
    .maybeSingle();
  dbFailure(error, "Could not remove knowledge source");
  if (!data) throw new ApiError(404, "not_found", "Knowledge source not found");
  await invalidateSandbox(db, agent37Id, data.workspace_id);
}

export async function resyncKnowledgeSource(
  db: DB,
  agent37Id: string,
  workspaceId: string,
  sourceId: string
) {
  const existing = await db
    .from("agent_whatsapp_knowledge_sources")
    .select("*")
    .eq("id", sourceId)
    .eq("agent37_id", agent37Id)
    .eq("workspace_id", workspaceId)
    .neq("status", "removed")
    .maybeSingle();
  dbFailure(existing.error, "Could not load knowledge source");
  if (!existing.data) throw new ApiError(404, "not_found", "Knowledge source not found");
  const row = existing.data as SourceRow;
  if (!row.content || !row.content_digest) {
    throw new ApiError(409, "source_not_ready", "The knowledge source has no content to re-sync");
  }

  const processing = await db
    .from("agent_whatsapp_knowledge_sources")
    .update({ status: "processing", last_error: null, updated_at: new Date().toISOString() })
    .eq("id", sourceId)
    .eq("agent37_id", agent37Id)
    .eq("workspace_id", workspaceId);
  dbFailure(processing.error, "Could not start knowledge source re-sync");
  await invalidateSandbox(db, agent37Id, workspaceId);

  try {
    const refreshed = await refreshKnowledgeSource({
      id: row.id,
      kind: row.source_kind,
      label: row.label,
      mediaType: row.media_type,
      text: row.content,
      digest: row.content_digest,
      provenance: row.provenance,
    });
    const result = await db
      .from("agent_whatsapp_knowledge_sources")
      .update({
        label: refreshed.label,
        media_type: refreshed.mediaType,
        source_url: refreshed.provenance.url ?? null,
        content: refreshed.text,
        content_digest: refreshed.digest,
        provenance: refreshed.provenance,
        status: "ready",
        last_error: null,
        last_synced_at: refreshed.provenance.capturedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sourceId)
      .eq("agent37_id", agent37Id)
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();
    dbFailure(result.error, "Could not save re-synced knowledge source");
    return result.data as SourceRow;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Knowledge source re-sync failed";
    const failed = await db
      .from("agent_whatsapp_knowledge_sources")
      .update({ status: "failed", last_error: message.slice(0, 2_000), updated_at: new Date().toISOString() })
      .eq("id", sourceId)
      .eq("agent37_id", agent37Id)
      .eq("workspace_id", workspaceId);
    dbFailure(failed.error, "Could not record knowledge source re-sync failure");
    throw error;
  }
}

export async function publishKnowledge(db: DB, agent37Id: string, workspaceId: string) {
  const state = await getKnowledgeState(db, agent37Id);
  const snapshot = nextKnowledgeVersion(
    state.activeVersion === null
      ? null
      : ({ version: state.activeVersion, profile: state.profile, sources: state.readySources } satisfies KnowledgeSnapshot),
    state.profile,
    state.readySources
  );
  const prompt = compileKnowledgePrompt(snapshot);
  const { data, error } = await db.rpc("publish_whatsapp_knowledge", {
    p_agent37_id: agent37Id,
    p_workspace_id: workspaceId,
    p_expected_active_version: state.activeVersion,
    p_profile: snapshot.profile,
    p_sources: snapshot.sources,
    p_compiled_prompt: prompt,
  });
  if (error?.code === "40001") {
    throw new ApiError(409, "knowledge_version_conflict", "Knowledge changed while publishing; reload and retry");
  }
  dbFailure(error, "Could not publish knowledge");
  const version = Number(data);
  let synced = false;
  if (state.workflowId) {
    await deployKnowledgeSnapshot({
      client: kapso,
      workflowId: state.workflowId,
      agentNodeId: "customer_agent",
      version,
      prompt,
      persistSynced: async (syncedVersion) => {
        const now = new Date().toISOString();
        const result = await db
          .from("agent_whatsapp_connections")
          .update({
            synced_knowledge_version: syncedVersion,
            knowledge_last_synced_at: now,
            knowledge_last_error: null,
            updated_at: now,
          })
          .eq("agent37_id", agent37Id)
          .eq("workspace_id", workspaceId)
          .eq("kapso_workflow_id", state.workflowId)
          .select("synced_knowledge_version")
          .single();
        dbFailure(result.error, "Could not persist the synced knowledge version");
        if (result.data?.synced_knowledge_version !== syncedVersion) {
          throw new ApiError(500, "knowledge_sync_unverified", "The synced knowledge version could not be verified");
        }
        synced = true;
      },
      persistError: async (message) => {
        const result = await db
          .from("agent_whatsapp_connections")
          .update({ knowledge_last_error: message.slice(0, 2_000), updated_at: new Date().toISOString() })
          .eq("agent37_id", agent37Id)
          .eq("workspace_id", workspaceId)
          .eq("kapso_workflow_id", state.workflowId);
        dbFailure(result.error, "Could not persist the knowledge refresh failure");
      },
    });
  }
  return { version, prompt, snapshot, synced };
}
