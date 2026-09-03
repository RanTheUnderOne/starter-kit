import { createAdminClient } from "@/lib/supabase/admin";
import { metaAppSecret, metaVerifyToken } from "@/lib/alfi-config";
import {
  decideSharedNumberRoute,
  forwardSharedWebhook,
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

  try {
    const result = await forwardSharedWebhook(
      {
        messageIds: decision.messageIds,
        targetUrl,
        rawBody,
        signature: request.headers.get("x-hub-signature-256"),
      },
      (url, init) => fetch(url, init),
      {
        claim: async (id) => {
          const { error: duplicate } = await db.from("whatsapp_router_events").insert({
            idempotency_key: id,
            agent37_id: connection.agent37_id,
          });
          if (duplicate?.code === "23505") return "duplicate";
          if (duplicate) throw new Error(duplicate.message);
          return "ok";
        },
        release: async (ids) => {
          if (ids.length === 0) return;
          await db.from("whatsapp_router_events").delete().in("idempotency_key", ids);
        },
      }
    );
    return new Response(result.body, { status: result.status });
  } catch {
    return new Response("Router storage unavailable", { status: 503 });
  }
}
