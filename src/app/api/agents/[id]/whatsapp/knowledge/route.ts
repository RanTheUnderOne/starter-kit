import { requireAgentAccess } from "@/lib/auth";
import { ApiError, handleError, json, readJson } from "@/lib/http";
import {
  compileKnowledgePrompt,
  KnowledgeValidationError,
  type BusinessProfile,
} from "@/lib/whatsapp-knowledge";
import {
  getKnowledgeState,
  publishKnowledge,
  saveKnowledgeProfile,
} from "@/lib/whatsapp-knowledge-store";

function knowledgeError(error: unknown) {
  if (error instanceof KnowledgeValidationError) {
    return handleError(new ApiError(400, error.code, error.message));
  }
  return handleError(error);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db } = await requireAgentAccess(id);
    const state = await getKnowledgeState(db, id);
    const { readySources: _readySources, ...publicState } = state;
    return json({
      ...publicState,
      previewPrompt: compileKnowledgePrompt({
        version: (state.activeVersion ?? 0) + 1,
        profile: state.profile,
        sources: state.readySources,
      }),
    });
  } catch (error) {
    return knowledgeError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db, row } = await requireAgentAccess(id, "admin");
    const profile = await readJson<Partial<BusinessProfile>>(request);
    return json({ profile: await saveKnowledgeProfile(db, id, row.workspace_id, profile) });
  } catch (error) {
    return knowledgeError(error);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db, row } = await requireAgentAccess(id, "admin");
    const published = await publishKnowledge(db, id, row.workspace_id);
    return json({
      version: published.version,
      compiledPrompt: published.prompt,
      sourceCount: published.snapshot.sources.length,
      synced: published.synced,
    });
  } catch (error) {
    return knowledgeError(error);
  }
}
