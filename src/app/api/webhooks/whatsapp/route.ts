import { createAdminClient } from "@/lib/supabase/admin";
import { metaAppSecret, metaVerifyToken } from "@/lib/alfi-config";
import {
  decideSharedNumberRoute,
  metaChallengeResponse,
  toE164,
  trustedForwardUrl,
  verifyMetaSignature,
} from "@/lib/whatsapp-router";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    return metaChallengeResponse(request.url, metaVerifyToken());
  } catch {
    return new Response("Router unavailable", { status: 503 });
  }
}

export async function POST(request: Request) {
  let secret: string;
  try {
    secret = metaAppSecret();
  } catch {
    return new Response("Router unavailable", { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const decision = decideSharedNumberRoute(rawBody);
  if (decision.action !== "forward") {
    return new Response(decision.action === "ignore" ? "Ignored" : "Rejected", { status: 200 });
  }

  const db = createAdminClient();
  const { data: connection, error } = await db
    .from("agent_whatsapp_connections")
    .select("agent37_id, webhook_url")
    .eq("owner_phone_e164", toE164(decision.sender))
    .maybeSingle();
  if (error) return new Response("Router storage unavailable", { status: 503 });
  if (!connection) return new Response("Unknown sender", { status: 200 });

  const targetUrl = trustedForwardUrl(connection.agent37_id, connection.webhook_url);
  if (!targetUrl) return new Response("Untrusted webhook", { status: 200 });

  if (decision.messageId) {
    const { error: duplicate } = await db.from("whatsapp_router_events").insert({
      idempotency_key: decision.messageId,
      agent37_id: connection.agent37_id,
    });
    if (duplicate?.code === "23505") return new Response("Already processed", { status: 200 });
    if (duplicate) return new Response("Router storage unavailable", { status: 503 });
  }

  try {
    const signature = request.headers.get("x-hub-signature-256");
    const headers = new Headers({ "content-type": "application/json" });
    if (signature) headers.set("x-hub-signature-256", signature);
    const downstream = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: rawBody,
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    return new Response(await downstream.text(), { status: downstream.status });
  } catch {
    if (decision.messageId) {
      await db.from("whatsapp_router_events").delete().eq("idempotency_key", decision.messageId);
    }
    return new Response("Downstream unavailable", { status: 502 });
  }
}
