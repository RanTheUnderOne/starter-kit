import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hashTokenWithPepper } from "../src/lib/alfi-crypto";
import { resolveAlfiPublicOrigin } from "../src/lib/alfi-public-url";
import { verifyKapsoSignature } from "../src/lib/kapso-webhook";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Alfi WhatsApp security contracts", () => {
  it("isolates equal tokens under different peppers", () => {
    expect(hashTokenWithPepper("tenant-token", "pepper-a")).not.toBe(
      hashTokenWithPepper("tenant-token", "pepper-b")
    );
  });

  it("verifies Kapso signatures against the exact raw body", () => {
    const body = '{"phone_number_id":"123"}';
    const signature = createHmac("sha256", "secret").update(body).digest("hex");
    expect(verifyKapsoSignature(body, signature, "secret")).toBe(true);
    expect(verifyKapsoSignature(`${body}\n`, signature, "secret")).toBe(false);
    expect(verifyKapsoSignature(body, null, "secret")).toBe(false);
  });

  it("keeps tenant selection out of MCP tool inputs", () => {
    const route = read("src/app/api/mcp/whatsapp/route.ts");
    expect(route).not.toMatch(/inputSchema:\s*\{[^}]*phone_number_id/s);
    expect(route).toContain("requireConnected(connection)");
    expect(route).toContain("ensureScoped");
  });

  it("installs the WhatsApp skill and environment-backed MCP config", () => {
    const provisioner = read("src/lib/alfi-provisioning.ts");
    const skill = read("agent/alfi-structure/skills/whatsapp/mcp/SKILL.md");
    expect(provisioner).toContain(".hermes/skills");
    expect(provisioner).toContain("${ALFI_WHATSAPP_MCP_TOKEN}");
    expect(skill).toContain("requires explicit owner approval");
  });

  it("uses the preview deployment URL instead of production", () => {
    expect(
      resolveAlfiPublicOrigin({
        ALFI_PUBLIC_URL: "https://alfi-agents-dashboard.vercel.app",
        NEXT_PUBLIC_SITE_URL: "https://alfi-agents-dashboard.vercel.app",
        VERCEL_ENV: "preview",
        VERCEL_BRANCH_URL: "alfi-agents-dashboa-git-ba2630-nadlanaisolutions-8350s-projects.vercel.app",
        VERCEL_URL: "alfi-agents-dashboard-preview.vercel.app",
      })
    ).toBe("https://alfi-agents-dashboa-git-ba2630-nadlanaisolutions-8350s-projects.vercel.app");
  });

  it("falls back to the site URL when ALFI_PUBLIC_URL is missing", () => {
    expect(
      resolveAlfiPublicOrigin({
        NEXT_PUBLIC_SITE_URL: "https://alfi-agents-dashboard.vercel.app",
        VERCEL_ENV: "production",
      })
    ).toBe("https://alfi-agents-dashboard.vercel.app");
  });

  it("deduplicates signed webhooks before changing connection state", () => {
    const route = read("src/app/api/webhooks/kapso/route.ts");
    expect(route.indexOf('from("kapso_webhook_events")')).toBeLessThan(
      route.indexOf('from("agent_whatsapp_connections")')
    );
    expect(route).toContain("verifyKapsoSignature");
  });
});
