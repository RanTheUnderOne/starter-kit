import { requireAgentAccess } from "@/lib/auth";
import { ApiError, handleError, json, readJson } from "@/lib/http";
import { answerWhatsAppSandboxQuestion } from "@/lib/whatsapp-dashboard";
import { getKnowledgeState } from "@/lib/whatsapp-knowledge-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db, row } = await requireAgentAccess(id, "admin");
    const body = await readJson<{ question?: string }>(request);
    const question = body.question?.trim();
    if (!question) throw new ApiError(400, "question_required", "Enter a test customer question");
    if (question.length > 2_000) {
      throw new ApiError(400, "question_too_long", "Test questions must be 2,000 characters or shorter");
    }
    const state = await getKnowledgeState(db, id);
    const answer = answerWhatsAppSandboxQuestion(question, {
      profile: state.profile,
      sources: state.readySources,
    });
    const testedAt = new Date().toISOString();
    const { error } = await db
      .from("agent_whatsapp_connections")
      .update({ sandbox_tested_at: testedAt, updated_at: testedAt })
      .eq("agent37_id", id)
      .eq("workspace_id", row.workspace_id);
    if (error) throw error;
    return json({ ...answer, testedAt });
  } catch (error) {
    return handleError(error);
  }
}
