import "server-only";
import { ALFI_BUNDLE, ALFI_DEFAULT_CRON_JOBS, ALFI_SKILL_NAMES } from "@/generated/alfi-bundle";
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

function hermesPython(script: string, after = "") {
  const suffix = after ? `\n${after}` : "";
  return `HERMES_BIN=$(command -v hermes)
HERMES_PYTHON=$(sed -n '1s/^#!//p' "$HERMES_BIN")
"$HERMES_PYTHON" - <<'PY'
${script}
PY${suffix}`;
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
display=cfg.setdefault("display", {})
display["show_reasoning"]=False
display["memory_notifications"]=False
display["busy_ack_enabled"]=False
display["tool_progress"]=False
display["interim_assistant_messages"]=False
display["show_commentary"]=False
display["long_running_notifications"]=False
display.setdefault("runtime_footer", {})["enabled"]=False
whatsapp=display.setdefault("platforms", {}).setdefault("whatsapp_cloud", {})
whatsapp["tool_progress"]=False
whatsapp["interim_assistant_messages"]=False
whatsapp["show_commentary"]=False
whatsapp["long_running_notifications"]=False
whatsapp["busy_ack_enabled"]=False
whatsapp["cleanup_progress"]=False
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
  return hermesPython(script, "hermes config check");
}

function disableStockSkillsCommand() {
  const keep = JSON.stringify([...ALFI_SKILL_NAMES]);
  const script = `
import os, subprocess, pathlib, tempfile
import yaml
keep = set(${keep})
subprocess.run(["hermes", "skills", "opt-out", "--remove", "--yes"], check=False)
env = os.environ.copy()
env["COLUMNS"] = "400"
env["NO_COLOR"] = "1"
out = subprocess.check_output(["hermes", "skills", "list"], env=env, text=True)
names = []
for line in out.splitlines():
    if "\\u2502" not in line and "|" not in line:
        continue
    raw = line.replace("\\u2502", "|")
    cols = [c.strip() for c in raw.strip().strip("|").split("|")]
    if not cols:
        continue
    name = cols[0]
    if not name or name == "Name" or any(ch in name for ch in "\\u2501\\u2500"):
        continue
    names.append(name)
disabled = sorted({n for n in names if n not in keep})
p = pathlib.Path.home() / ".hermes" / "config.yaml"
cfg = {}
if p.exists():
    cfg = yaml.safe_load(p.read_text()) or {}
skills = cfg.setdefault("skills", {})
skills["disabled"] = disabled
p.parent.mkdir(parents=True, exist_ok=True)
fd, tmp = tempfile.mkstemp(prefix="config-", suffix=".yaml", dir=str(p.parent), text=True)
try:
    with os.fdopen(fd, "w") as f:
        yaml.safe_dump(cfg, f, sort_keys=False)
        f.flush()
        os.fsync(f.fileno())
    os.chmod(tmp, 0o600)
    os.replace(tmp, p)
finally:
    if os.path.exists(tmp):
        os.unlink(tmp)
print("disabled", len(disabled), "kept", len(keep))
`;
  return hermesPython(script, "hermes config check");
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
    await agent37.exec(agentId, disableStockSkillsCommand());
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
