import { requireAgentAccess } from "@/lib/auth";
import { ApiError, handleError, json, readJson } from "@/lib/http";
import { KnowledgeValidationError } from "@/lib/whatsapp-knowledge";
import {
  addFileKnowledge,
  addTextKnowledge,
  addUrlKnowledge,
} from "@/lib/whatsapp-knowledge-store";

function knowledgeError(error: unknown) {
  if (error instanceof KnowledgeValidationError) {
    const status = error.code.endsWith("too_large") ? 413 : 400;
    return handleError(new ApiError(status, error.code, error.message));
  }
  return handleError(error);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db, row } = await requireAgentAccess(id, "admin");
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.startsWith("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new ApiError(400, "file_required", "A file upload is required");
      return json({ source: await addFileKnowledge(db, id, row.workspace_id, file) }, 201);
    }

    const body = await readJson<{ kind?: "text" | "url"; label?: string; text?: string; url?: string }>(
      request
    );
    if (body.kind === "text") {
      if (!body.text) throw new ApiError(400, "text_required", "Knowledge text is required");
      return json(
        { source: await addTextKnowledge(db, id, row.workspace_id, body.label ?? "Pasted text", body.text) },
        201
      );
    }
    if (body.kind === "url") {
      if (!body.url) throw new ApiError(400, "url_required", "A knowledge URL is required");
      return json({ source: await addUrlKnowledge(db, id, row.workspace_id, body.url) }, 201);
    }
    throw new ApiError(400, "invalid_source", "Choose text, URL, or a supported file upload");
  } catch (error) {
    return knowledgeError(error);
  }
}
