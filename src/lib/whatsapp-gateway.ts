import { createAdminClient } from "./supabase/admin";
import * as agent37 from "./agent37";
import {
  HERMES_WHATSAPP_PORT,
  HERMES_WHATSAPP_PORT_PREFIX,
  parseOwnerPhone,
} from "./alfi-config";
import { hermesWebhookUrl } from "./whatsapp-router";
import type { Agent } from "./types";

const PHONE_TAKEN = "PHONE_TAKEN";

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function upsertEnv(existing: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(existing)) return existing.replace(pattern, line);
  const trimmed = existing.replace(/\s+$/, "");
  return trimmed ? `${trimmed}\n${line}\n` : `${line}\n`;
}

export async function saveOwnerPhone(agentId: string, rawPhone: string): Promise<string> {
  const phone = parseOwnerPhone(rawPhone);
  if (!phone) {
    throw new Error("Enter a valid WhatsApp number with country code");
  }
  const db = createAdminClient();
  const { data: taken } = await db
    .from("agents")
    .select("id")
    .eq("owner_phone_e164", phone)
    .neq("id", agentId)
    .maybeSingle();
  if (taken) {
    const error = new Error("That WhatsApp number is already assigned to another agent");
    Object.assign(error, { code: PHONE_TAKEN });
    throw error;
  }
  const { error } = await db
    .from("agents")
    .update({ owner_phone_e164: phone, updated_at: new Date().toISOString() })
    .eq("id", agentId);
  if (error) {
    if (error.code === "23505") {
      const conflict = new Error("That WhatsApp number is already assigned to another agent");
      Object.assign(conflict, { code: PHONE_TAKEN });
      throw conflict;
    }
    throw error;
  }
  return phone;
}

export function isPhoneTaken(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === PHONE_TAKEN);
}

async function mergeHermesEnv(instanceId: string, values: Record<string, string>): Promise<void> {
  const current = await agent37.execInInstance(instanceId, [
    "bash",
    "-lc",
    "cat ~/.hermes/.env 2>/dev/null || true",
  ]);
  let next = current.stdout || "";
  for (const [key, value] of Object.entries(values)) {
    if (value) next = upsertEnv(next, key, value);
  }
  await agent37.writeFileInInstance(instanceId, "/root/.hermes/.env", next);
}

export async function configureSharedWhatsApp(agent: Agent, ownerPhone: string): Promise<void> {
  if (!agent.instance_id) throw new Error("Agent has no instance");
  const db = createAdminClient();
  const webhookUrl = hermesWebhookUrl(agent.instance_id);

  try {
    await agent37.createPublicPort(
      agent.instance_id,
      HERMES_WHATSAPP_PORT,
      HERMES_WHATSAPP_PORT_PREFIX,
    );
  } catch {
    // Port may already exist from instance create.
  }

  const values: Record<string, string> = {
    WHATSAPP_CLOUD_ALLOWED_USERS: ownerPhone,
    WHATSAPP_CLOUD_ALLOW_ALL_USERS: "false",
    SESSION_IDLE_TIMEOUT: "0",
  };
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
  const appSecret = process.env.META_APP_SECRET;
  const verifyToken = process.env.META_VERIFY_TOKEN;
  if (phoneNumberId) values.WHATSAPP_CLOUD_PHONE_NUMBER_ID = phoneNumberId;
  if (accessToken) values.WHATSAPP_CLOUD_ACCESS_TOKEN = accessToken;
  if (appSecret) values.WHATSAPP_CLOUD_APP_SECRET = appSecret;
  if (verifyToken) values.WHATSAPP_CLOUD_VERIFY_TOKEN = verifyToken;

  await mergeHermesEnv(agent.instance_id, values);

  if (phoneNumberId && accessToken && appSecret && verifyToken) {
    await agent37.execInInstance(agent.instance_id, [
      "bash",
      "-lc",
      [
        "python3 - <<'PY'",
        "from pathlib import Path",
        "p = Path.home() / '.hermes' / 'config.yaml'",
        "text = p.read_text() if p.exists() else ''",
        "if 'whatsapp_cloud:' in text:",
        "    import re",
        "    text = re.sub(r'(whatsapp_cloud:[\\s\\S]*?enabled:)\\s*false', r'\\1 true', text, count=1)",
        "    p.write_text(text)",
        "PY",
        "hermes restart || true",
      ].join("\n"),
    ]);
  }

  await db
    .from("agents")
    .update({
      webhook_url: webhookUrl,
      whatsapp_status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", agent.id);
}

export async function lookupAgentByOwnerPhone(phone: string): Promise<Agent | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("agents")
    .select("*")
    .eq("owner_phone_e164", phone)
    .maybeSingle();
  return (data as Agent | null) ?? null;
}
