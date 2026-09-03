import { createHmac, timingSafeEqual } from "node:crypto";

export const HERMES_WHATSAPP_PORT = 8090;
export const HERMES_WHATSAPP_PREFIX = "wa";
export const HERMES_WHATSAPP_PATH = "/whatsapp/webhook";

type JsonObject = Record<string, unknown>;

export type SharedNumberDecision =
  | { action: "ignore" }
  | { action: "reject" }
  | { action: "forward"; sender: string; messageId: string | null; messageIds: string[] };

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function changesFrom(payload: JsonObject): JsonObject[] {
  if (!Array.isArray(payload.entry)) return [];
  return payload.entry.flatMap((entry) => {
    if (!isObject(entry) || !Array.isArray(entry.changes)) return [];
    return entry.changes.filter(isObject);
  });
}

function messagesFrom(payload: JsonObject): JsonObject[] {
  return changesFrom(payload).flatMap((change) => {
    if (!isObject(change.value) || !Array.isArray(change.value.messages)) return [];
    return change.value.messages.filter(isObject);
  });
}

/** WhatsApp Cloud `wa_id`: digits only, country code, no plus. */
export function normalizeWaId(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function toE164(waId: string): string {
  return `+${waId}`;
}

export function parseOwnerPhone(input: string | null | undefined): { waId: string; e164: string } | null {
  const waId = normalizeWaId(input);
  if (!waId) return null;
  return { waId, e164: toE164(waId) };
}

export function verifyMetaSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = header.slice("sha256=".length);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function metaChallengeResponse(requestUrl: string, verifyToken: string): Response {
  const url = new URL(requestUrl);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode !== "subscribe" || !challenge || token !== verifyToken) {
    return new Response("Verification failed", { status: 403 });
  }
  return new Response(challenge, { status: 200 });
}

export function decideSharedNumberRoute(rawBody: string): SharedNumberDecision {
  let payload: JsonObject;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!isObject(parsed)) return { action: "reject" };
    payload = parsed;
  } catch {
    return { action: "reject" };
  }

  const messages = messagesFrom(payload);
  if (messages.length === 0) return { action: "ignore" };

  const senders = new Set<string>();
  const messageIds: string[] = [];
  for (const message of messages) {
    const sender = normalizeWaId(typeof message.from === "string" ? message.from : null);
    if (!sender) return { action: "reject" };
    senders.add(sender);
    if (typeof message.id === "string" && message.id) messageIds.push(message.id);
  }

  if (senders.size !== 1) return { action: "reject" };
  const [sender] = senders;
  return { action: "forward", sender, messageId: messageIds[0] ?? null, messageIds };
}

export function hermesWebhookUrl(agentId: string): string {
  return `https://${HERMES_WHATSAPP_PREFIX}-${agentId}.agent37.app${HERMES_WHATSAPP_PATH}`;
}

export function canonicalHermesWebhook(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (parsed.port && parsed.port !== "443") return null;
    if (parsed.search || parsed.hash) return null;
    if (parsed.username || parsed.password) return null;
    if (parsed.pathname !== HERMES_WHATSAPP_PATH) return null;
    if (!parsed.hostname.endsWith(".agent37.app") || parsed.hostname === "agent37.app") return null;
    return `https://${parsed.hostname}${HERMES_WHATSAPP_PATH}`;
  } catch {
    return null;
  }
}

export function isTrustedHermesWebhook(url: string | null | undefined): boolean {
  return canonicalHermesWebhook(url) !== null;
}

export function trustedForwardUrl(agentId: string, storedUrl: string | null | undefined): string | null {
  const expected = canonicalHermesWebhook(hermesWebhookUrl(agentId));
  if (!expected) return null;
  if (!storedUrl) return expected;
  const stored = canonicalHermesWebhook(storedUrl);
  return stored === expected ? expected : null;
}

export async function forwardSharedWebhook(
  fixture: {
    messageIds: string[];
    targetUrl: string;
    rawBody: string;
    signature?: string | null;
  },
  send: (url: string, init: RequestInit) => Promise<Response>,
  persistence?: {
    claim: (id: string) => Promise<"ok" | "duplicate">;
    release: (ids: string[]) => Promise<void>;
  }
): Promise<{ status: number; body: string; releasedIds: string[] }> {
  const claimed = new Set<string>();
  const store = persistence ?? {
    async claim(id: string) {
      if (claimed.has(id)) return "duplicate" as const;
      claimed.add(id);
      return "ok" as const;
    },
    async release(ids: string[]) {
      for (const id of ids) claimed.delete(id);
    },
  };

  const inserted: string[] = [];
  for (const id of fixture.messageIds) {
    const result = await store.claim(id);
    if (result === "ok") inserted.push(id);
  }
  if (fixture.messageIds.length > 0 && inserted.length === 0) {
    return { status: 200, body: "Already processed", releasedIds: [] };
  }

  try {
    const headers = new Headers({ "content-type": "application/json" });
    if (fixture.signature) headers.set("x-hub-signature-256", fixture.signature);
    const downstream = await send(fixture.targetUrl, {
      method: "POST",
      headers,
      body: fixture.rawBody,
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (downstream.status < 200 || downstream.status >= 300) {
      await store.release(inserted);
      return {
        status: 502,
        body: "Downstream unavailable",
        releasedIds: inserted,
      };
    }
    return { status: downstream.status, body: await downstream.text(), releasedIds: [] };
  } catch {
    await store.release(inserted);
    return { status: 502, body: "Downstream unavailable", releasedIds: inserted };
  }
}
