import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const ADMIN_TOOLS = [
  "get_whatsapp_agent_status",
  "provision_whatsapp_agent",
  "get_whatsapp_agent_profile",
  "update_whatsapp_agent_profile",
  "list_knowledge_sources",
  "add_knowledge_source",
  "remove_knowledge_source",
  "resync_knowledge_source",
  "test_whatsapp_agent",
  "enable_whatsapp_agent",
  "disable_whatsapp_agent",
  "list_active_handoffs",
  "handoff_conversation",
  "resume_conversation",
  "inspect_workflow_runs",
] as const;

describe("WhatsApp Agent administration MCP contract", () => {
  it("registers the complete narrow administration surface with explicit output schemas", () => {
    const route = read("src/app/api/mcp/whatsapp/route.ts");
    for (const tool of ADMIN_TOOLS) expect(route).toContain(`"${tool}"`);
    expect(route.match(/outputSchema:/g)).toHaveLength(ADMIN_TOOLS.length);
    expect(route).toContain("structuredContent");
  });

  it("binds tenancy to the MCP credential rather than caller-selected identifiers", () => {
    const route = read("src/app/api/mcp/whatsapp/route.ts");
    expect(route).not.toMatch(/inputSchema:\s*\{[^}]*(workspace_id|agent37_id|phone_number_id)/s);
    expect(route).toContain("assertCurrentConnection");
    expect(route).toContain('.eq("workspace_id", connection.workspace_id)');
    expect(route).toContain('.eq("agent37_id", connection.agent37_id)');
  });

  it("requires owner confirmation and request IDs for high-risk or externally mutating tools", () => {
    const route = read("src/app/api/mcp/whatsapp/route.ts");
    expect(route).toContain("ownerConfirmationSchema");
    for (const tool of [
      "remove_knowledge_source",
      "test_whatsapp_agent",
      "enable_whatsapp_agent",
      "disable_whatsapp_agent",
      "handoff_conversation",
      "resume_conversation",
    ]) {
      const start = route.indexOf(`"${tool}"`);
      expect(start).toBeGreaterThan(-1);
      expect(route.slice(start, start + 1_200)).toContain("ownerConfirmationSchema");
    }
  });

  it("never serializes credential fields and records mutations in a tenant-scoped audit table", () => {
    const route = read("src/app/api/mcp/whatsapp/route.ts");
    const migration = read("supabase/migrations/0006_whatsapp_agent_mcp_audit.sql");
    expect(route).not.toContain("token_hash:");
    expect(route).toContain("runAuditedMutation");
    expect(route).toContain("redactSensitive");
    expect(route).toMatch(/toolError[\s\S]{0,300}redactSensitive/);
    expect(migration).toContain("agent_whatsapp_mcp_audit");
    expect(migration).toContain("workspace_id");
    expect(migration).toContain("unique (agent37_id, tool_name, request_id)");
  });

  it("documents the administration tools and owner-approval contract for the provisioned Hermes agent", () => {
    const skill = read("agent/alfi-structure/skills/whatsapp/mcp/SKILL.md");
    for (const tool of ADMIN_TOOLS) expect(skill).toContain(`\`${tool}\``);
    expect(skill).toContain("request_id");
    expect(skill).toContain("owner_confirmed: true");
    expect(skill).toContain("must not enable itself");
  });
});
