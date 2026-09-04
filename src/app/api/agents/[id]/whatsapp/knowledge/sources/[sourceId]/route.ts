import { requireAgentAccess } from "@/lib/auth";
import { ApiError, handleError, json } from "@/lib/http";
import { KnowledgeValidationError } from "@/lib/whatsapp-knowledge";
import { removeKnowledgeSource, resyncKnowledgeSource } from "@/lib/whatsapp-knowledge-store";

function knowledgeError(error: unknown) {
  if (error instanceof KnowledgeValidationError) {
    const status = error.code.endsWith("too_large") ? 413 : 400;
    return handleError(new ApiError(status, error.code, error.message));
  }
  return handleError(error);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { id, sourceId } = await params;
    const { db, row } = await requireAgentAccess(id, "admin");
    return json({ source: await resyncKnowledgeSource(db, id, row.workspace_id, sourceId) });
  } catch (error) {
    return knowledgeError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { id, sourceId } = await params;
    const { db } = await requireAgentAccess(id, "admin");
    await removeKnowledgeSource(db, id, sourceId);
    return json({ removed: true });
  } catch (error) {
    return handleError(error);
  }
}
