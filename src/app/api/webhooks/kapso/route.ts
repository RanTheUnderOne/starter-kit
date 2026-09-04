import { createAdminClient } from "@/lib/supabase/admin";
import { kapsoWebhookSecret } from "@/lib/alfi-config";
import { verifyKapsoSignature } from "@/lib/kapso-webhook";
import { kapso } from "@/lib/kapso";
import { kapsoDeletedPatch } from "@/lib/kapso-lifecycle";

type ConnectionEvent = {
  event?: string;
  occurred_at?: string;
  phone_number_id?: string;
  display_phone_number?: string;
  customer?: { id?: string };
  workflow_id?: string;
  workflow_execution_id?: string;
  whatsapp_conversation_id?: string | null;
  handoff?: { reason?: string | null; source?: string | null };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyKapsoSignature(rawBody, request.headers.get("x-webhook-signature"), kapsoWebhookSecret())) {
    return new Response("Invalid signature", { status: 401 });
  }
  const idempotencyKey = request.headers.get("x-idempotency-key");
  if (!idempotencyKey) return new Response("Missing idempotency key", { status: 400 });

  let body: ConnectionEvent;
  try {
    body = JSON.parse(rawBody) as ConnectionEvent;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType = request.headers.get("x-webhook-event") ?? body.event ?? "";

  const db = createAdminClient();
  const { error: duplicate } = await db
    .from("kapso_webhook_events")
    .insert({ idempotency_key: idempotencyKey, event_type: eventType });
  if (duplicate?.code === "23505") return new Response("Already processed", { status: 200 });
  if (duplicate) return new Response("Webhook storage unavailable", { status: 503 });

  if (eventType === "workflow.execution.handoff") {
    if (!body.workflow_id || !body.workflow_execution_id) {
      await db.from("kapso_webhook_events").delete().eq("idempotency_key", idempotencyKey);
      return new Response("Invalid handoff payload", { status: 400 });
    }
    const { data: connection, error: lookupError } = await db
      .from("agent_whatsapp_connections")
      .select("agent37_id, workspace_id")
      .eq("kapso_workflow_id", body.workflow_id)
      .maybeSingle();
    if (lookupError) {
      await db.from("kapso_webhook_events").delete().eq("idempotency_key", idempotencyKey);
      return new Response("Handoff lookup failed", { status: 503 });
    }
    if (!connection) return new Response("Accepted", { status: 200 });

    const occurredAt = body.occurred_at ?? new Date().toISOString();
    const { error: handoffError } = await db.from("agent_whatsapp_handoffs").upsert({
      workflow_execution_id: body.workflow_execution_id,
      agent37_id: connection.agent37_id,
      workspace_id: connection.workspace_id,
      kapso_workflow_id: body.workflow_id,
      whatsapp_conversation_id: body.whatsapp_conversation_id ?? null,
      reason: body.handoff?.reason ?? null,
      source: body.handoff?.source ?? null,
      status: "handoff",
      occurred_at: occurredAt,
      resumed_at: null,
      updated_at: new Date().toISOString(),
    });
    if (handoffError) {
      await db.from("kapso_webhook_events").delete().eq("idempotency_key", idempotencyKey);
      return new Response("Handoff storage failed", { status: 503 });
    }
    return new Response("OK");
  }

  const customerId = body.customer?.id;
  if (!customerId) return new Response("Accepted", { status: 200 });

  if (eventType === "whatsapp.phone_number.created" && body.phone_number_id) {
    let number:
      | { business_account_id?: string | null; display_phone_number?: string | null }
      | undefined;
    try {
      number = await kapso.getPhoneNumber(body.phone_number_id);
    } catch {
      // The connection is still valid; reconciliation can fill optional metadata later.
    }
    const { error } = await db
      .from("agent_whatsapp_connections")
      .update({
        status: "connected",
        enabled: true,
        phone_number_id: body.phone_number_id,
        business_account_id: number?.business_account_id ?? null,
        display_phone_number:
          number?.display_phone_number ?? body.display_phone_number ?? null,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("kapso_customer_id", customerId);
    if (error) {
      await db.from("kapso_webhook_events").delete().eq("idempotency_key", idempotencyKey);
      return new Response("Connection update failed", { status: 503 });
    }
  } else if (eventType === "whatsapp.phone_number.deleted") {
    const { error } = await db
      .from("agent_whatsapp_connections")
      .update(kapsoDeletedPatch())
      .eq("kapso_customer_id", customerId);
    if (error) {
      await db.from("kapso_webhook_events").delete().eq("idempotency_key", idempotencyKey);
      return new Response("Connection update failed", { status: 503 });
    }
  }

  return new Response("OK");
}
