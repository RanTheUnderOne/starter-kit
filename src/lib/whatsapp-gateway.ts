import "server-only";
import { agent37, Agent37Error } from "@/lib/agent37";
import { whatsappCloudConfig } from "@/lib/alfi-config";
import type { DB } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import {
  HERMES_WHATSAPP_PATH,
  HERMES_WHATSAPP_PORT,
  HERMES_WHATSAPP_PREFIX,
  hermesWebhookUrl,
  isTrustedHermesWebhook,
  parseOwnerPhone,
} from "@/lib/whatsapp-router";

function hermesEnvCommand(vars: Record<string, string>) {
  const payload = Buffer.from(JSON.stringify(vars)).toString("base64");
  return `python3 - <<'PY'
import base64, json, pathlib
vars = json.loads(base64.b64decode("${payload}").decode())
p = pathlib.Path.home() / ".hermes" / ".env"
p.parent.mkdir(parents=True, exist_ok=True)
existing = {}
if p.exists():
    for line in p.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        existing[key] = value
existing.update(vars)
p.write_text("".join(f"{key}={value}\n" for key, value in existing.items()))
PY`;
}

async function ensureWhatsAppPublicPort(agentId: string): Promise<string> {
  const agent = await agent37.getAgent(agentId);
  const existing = agent.public_ports?.find((port) => port.port === HERMES_WHATSAPP_PORT);
  if (existing?.url) {
    return `${existing.url.replace(/\/+$/, "")}${HERMES_WHATSAPP_PATH}`;
  }
  try {
    const created = await agent37.createPublicPort(agentId, {
      port: HERMES_WHATSAPP_PORT,
      prefix: HERMES_WHATSAPP_PREFIX,
    });
    return `${created.url.replace(/\/+$/, "")}${HERMES_WHATSAPP_PATH}`;
  } catch (error) {
    if (error instanceof Agent37Error && error.status === 409) {
      return hermesWebhookUrl(agentId);
    }
    throw error;
  }
}

export async function saveOwnerPhone(db: DB, agentId: string, phone: string) {
  const parsed = parseOwnerPhone(phone);
  if (!parsed) {
    throw new ApiError(400, "invalid_request", "Enter a WhatsApp number with country code");
  }

  const { data: taken, error: lookupError } = await db
    .from("agent_whatsapp_connections")
    .select("agent37_id")
    .eq("owner_phone_e164", parsed.e164)
    .neq("agent37_id", agentId)
    .maybeSingle();
  if (lookupError) throw new ApiError(500, "db_error", lookupError.message);
  if (taken) {
    throw new ApiError(409, "phone_in_use", "This WhatsApp number is already assigned to another Alfi");
  }

  const webhookUrl = hermesWebhookUrl(agentId);
  const { error } = await db
    .from("agent_whatsapp_connections")
    .update({
      owner_phone_e164: parsed.e164,
      webhook_url: webhookUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("agent37_id", agentId);
  if (error?.code === "23505") {
    throw new ApiError(409, "phone_in_use", "This WhatsApp number is already assigned to another Alfi");
  }
  if (error) throw new ApiError(500, "db_error", error.message);
  return parsed;
}

export async function configureSharedWhatsApp(db: DB, agentId: string) {
  const { data, error } = await db
    .from("agent_whatsapp_connections")
    .select("owner_phone_e164")
    .eq("agent37_id", agentId)
    .maybeSingle();
  if (error) throw new ApiError(500, "db_error", error.message);
  const parsed = parseOwnerPhone(data?.owner_phone_e164);
  if (!parsed) return;

  const webhookUrl = await ensureWhatsAppPublicPort(agentId);
  if (!isTrustedHermesWebhook(webhookUrl)) {
    throw new ApiError(500, "config_error", "Hermes WhatsApp webhook URL is not trusted");
  }

  const { error: updateError } = await db
    .from("agent_whatsapp_connections")
    .update({ webhook_url: webhookUrl, updated_at: new Date().toISOString() })
    .eq("agent37_id", agentId);
  if (updateError) throw new ApiError(500, "db_error", updateError.message);

  const vars: Record<string, string> = {
    WHATSAPP_CLOUD_ALLOWED_USERS: parsed.waId,
    WHATSAPP_CLOUD_ALLOW_ALL_USERS: "false",
  };
  const cloud = whatsappCloudConfig();
  if (cloud) {
    vars.WHATSAPP_CLOUD_PHONE_NUMBER_ID = cloud.phoneNumberId;
    vars.WHATSAPP_CLOUD_ACCESS_TOKEN = cloud.accessToken;
    vars.WHATSAPP_CLOUD_APP_SECRET = cloud.appSecret;
    vars.WHATSAPP_CLOUD_VERIFY_TOKEN = cloud.verifyToken;
  }

  await agent37.exec(agentId, hermesEnvCommand(vars));
  if (cloud) {
    try {
      await agent37.restart(agentId);
    } catch {
      await agent37.start(agentId);
    }
  }
}
