import "server-only";
import { ALFI_BUNDLE, ALFI_DEFAULT_CRON_JOBS } from "@/generated/alfi-bundle";
import { agent37 } from "@/lib/agent37";
import type { DB } from "@/lib/auth";
import { buildCronInstallSteps } from "@/lib/alfi-provisioning-core";
import { createCronJob, encodeHermesCronExec, listCronJobs } from "@/lib/hermes-cron";
import { configureSharedWhatsApp } from "@/lib/whatsapp-gateway";

const MAX_COMMAND_CHARS = 90_000;

function destination(relative: string) {
  if (relative === "SOUL.md") return "$HOME/.hermes/SOUL.md";
  if (relative.startsWith("skills/")) {
    return `$HOME/.hermes/skills/${relative.slice("skills/".length)}`;
  }
  if (relative.startsWith("config/")) {
    return `$HOME/.hermes/alfi/${relative}`;
  }
  throw new Error(`Unsupported Alfi bundle path: ${relative}`);
}

function fileCommand(relative: string, base64: string) {
  const dest = destination(relative);
  const dir = dest.slice(0, dest.lastIndexOf("/"));
  return `mkdir -p "${dir}" && printf '%s' '${base64}' | base64 -d > "${dest}"`;
}

function configCommand() {
  const script = `
import os, tempfile, yaml
p=os.path.expanduser("~/.hermes/config.yaml")
try:
  with open(p) as f: cfg=yaml.safe_load(f) or {}
except FileNotFoundError:
  cfg={}
cfg["timezone"]="Asia/Jerusalem"
servers=cfg.setdefault("mcp_servers", {})
servers["alfi_whatsapp"]={
  "url":"\${ALFI_WHATSAPP_MCP_URL}",
  "headers":{"Authorization":"Bearer \${ALFI_WHATSAPP_MCP_TOKEN}"},
  "enabled":True,
}
platforms=cfg.setdefault("platforms", {})
platforms.setdefault("whatsapp_cloud", {})["enabled"]=True
os.makedirs(os.path.dirname(p), exist_ok=True)
fd,tmp=tempfile.mkstemp(prefix="config-",suffix=".yaml",dir=os.path.dirname(p),text=True)
try:
  with os.fdopen(fd,"w") as f:
    yaml.safe_dump(cfg,f,sort_keys=False)
    f.flush()
    os.fsync(f.fileno())
  os.chmod(tmp,0o600)
  os.replace(tmp,p)
finally:
  if os.path.exists(tmp): os.unlink(tmp)
`;
  return `python3 - <<'PY'\n${script}\nPY\nhermes config check`;
}

async function installDefaultCronJobs(agentId: string) {
  const existing = await listCronJobs(agentId);
  const missing = buildCronInstallSteps(existing, ALFI_DEFAULT_CRON_JOBS);
  for (const job of missing) {
    await createCronJob(
      agentId,
      { name: job.key, schedule: job.schedule, prompt: job.prompt },
      job.skills,
    );
  }
  const installed = await listCronJobs(agentId);
  const installedNames = new Set(installed.map((job) => job.name));
  const stillMissing = ALFI_DEFAULT_CRON_JOBS.filter((job) => !installedNames.has(job.key));
  if (stillMissing.length > 0) {
    throw new Error(`Hermes is missing Alfi scheduled jobs: ${stillMissing.map((job) => job.key).join(", ")}`);
  }
}

async function setProvisioning(
  db: DB,
  agentId: string,
  status: "running" | "ready" | "failed",
  error: string | null
) {
  await db
    .from("agent_whatsapp_connections")
    .update({
      provisioning_status: status,
      provisioning_error: error,
      updated_at: new Date().toISOString(),
    })
    .eq("agent37_id", agentId);
}

async function waitForHealthy(agentId: string) {
  const deadline = Date.now() + 90_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const health = await agent37.health(agentId);
      if (health.healthy) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Hermes gateway did not become healthy after provisioning");
}

export async function provisionAlfi(db: DB, agentId: string) {
  await setProvisioning(db, agentId, "running", null);
  try {
    const commands: string[] = [];
    let current = "";
    for (const file of ALFI_BUNDLE) {
      const command = fileCommand(file.path, file.base64);
      if (current && current.length + command.length + 4 > MAX_COMMAND_CHARS) {
        commands.push(current);
        current = command;
      } else {
        current = current ? `${current} && ${command}` : command;
      }
    }
    if (current) commands.push(current);

    for (const command of commands) await agent37.exec(agentId, command);
    await agent37.exec(agentId, configCommand());
    await agent37.restart(agentId);
    await waitForHealthy(agentId);
    await agent37.exec(
      agentId,
      "test -s \"$HOME/.hermes/SOUL.md\" && test -s \"$HOME/.hermes/skills/whatsapp/mcp/SKILL.md\" && hermes skills list >/dev/null"
    );
    await installDefaultCronJobs(agentId);
    await agent37.exec(agentId, encodeHermesCronExec(["doctor"]));
    await agent37.exec(agentId, encodeHermesCronExec(["status"]));
    await waitForHealthy(agentId);
    const { data: connection } = await db
      .from("agent_whatsapp_connections")
      .select("owner_phone_e164")
      .eq("agent37_id", agentId)
      .maybeSingle();
    if (connection?.owner_phone_e164) {
      await configureSharedWhatsApp(db, agentId);
      await waitForHealthy(agentId);
    }
    await setProvisioning(db, agentId, "ready", null);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Provisioning failed";
    await setProvisioning(db, agentId, "failed", message);
    throw error;
  }
}

export { installDefaultCronJobs };
