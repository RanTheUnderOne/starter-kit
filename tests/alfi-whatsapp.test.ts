import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hashTokenWithPepper } from "../src/lib/alfi-crypto";
import { resolveAlfiPublicOrigin } from "../src/lib/alfi-public-url";
import { verifyKapsoSignature } from "../src/lib/kapso-webhook";
import {
  decideSharedNumberRoute,
  hermesWebhookUrl,
  isTrustedHermesWebhook,
  parseOwnerPhone,
  trustedForwardUrl,
  verifyMetaSignature,
} from "../src/lib/whatsapp-router";

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

describe("shared Alfi WhatsApp number router", () => {
  it("normalizes owner phones to wa_id and E.164", () => {
    expect(parseOwnerPhone("+972 50-123-4567")).toEqual({
      waId: "972501234567",
      e164: "+972501234567",
    });
    expect(parseOwnerPhone("not-a-phone")).toBeNull();
  });

  it("verifies Meta signatures against the exact raw body", () => {
    const body = '{"entry":[]}';
    const signature = `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`;
    expect(verifyMetaSignature(body, signature, "secret")).toBe(true);
    expect(verifyMetaSignature(`${body}\n`, signature, "secret")).toBe(false);
    expect(verifyMetaSignature(body, signature.slice("sha256=".length), "secret")).toBe(false);
  });

  it("forwards one inbound sender and ignores statuses", () => {
    expect(
      decideSharedNumberRoute(
        JSON.stringify({
          entry: [
            {
              changes: [
                {
                  value: {
                    messages: [{ from: "972501234567", id: "wamid.1" }],
                  },
                },
              ],
            },
          ],
        })
      )
    ).toEqual({ action: "forward", sender: "972501234567", messageId: "wamid.1", messageIds: ["wamid.1"] });

    expect(
      decideSharedNumberRoute(
        JSON.stringify({
          entry: [{ changes: [{ value: { statuses: [{ id: "wamid.1", status: "read" }] } }] }],
        })
      )
    ).toEqual({ action: "ignore" });
  });

  it("rejects mixed-sender payloads", () => {
    expect(
      decideSharedNumberRoute(
        JSON.stringify({
          entry: [
            {
              changes: [
                {
                  value: {
                    messages: [
                      { from: "972501111111", id: "wamid.1" },
                      { from: "972502222222", id: "wamid.2" },
                    ],
                  },
                },
              ],
            },
          ],
        })
      )
    ).toEqual({ action: "reject" });
  });

  it("uses Hermes documented WhatsApp Cloud webhook defaults", () => {
    const router = read("src/lib/whatsapp-router.ts");
    const gateway = read("src/lib/whatsapp-gateway.ts");
    const provisioner = read("src/lib/alfi-provisioning.ts");
    expect(router).toContain("HERMES_WHATSAPP_PORT = 8090");
    expect(router).toContain('HERMES_WHATSAPP_PATH = "/whatsapp/webhook"');
    expect(gateway).not.toContain("WHATSAPP_CLOUD_WEBHOOK_PORT");
    expect(gateway).not.toContain("WHATSAPP_CLOUD_WEBHOOK_PATH");
    expect(`${router}${gateway}${provisioner}`).not.toContain("8091");
    expect(provisioner).toContain('platforms.setdefault("whatsapp_cloud"');
    expect(provisioner).toContain('cfg.setdefault("display", {})');
    expect(provisioner).toContain("interim_assistant_messages");
    expect(provisioner).toContain("show_commentary");
    expect(provisioner).toContain("busy_ack_enabled");
    expect(provisioner).toContain("cleanup_progress");
  });

  it("only forwards to HTTPS Hermes WhatsApp webhooks", () => {
    expect(hermesWebhookUrl("ab12cd34ef")).toBe(
      "https://wa-ab12cd34ef.agent37.app/whatsapp/webhook"
    );
    expect(isTrustedHermesWebhook("https://wa-ab12cd34ef.agent37.app/whatsapp/webhook")).toBe(true);
    expect(isTrustedHermesWebhook("https://evil.example/whatsapp/webhook")).toBe(false);
    expect(isTrustedHermesWebhook("https://wa-ab12cd34ef.agent37.app/v1/chat")).toBe(false);
    expect(trustedForwardUrl("ab12cd34ef", "https://evil.example/whatsapp/webhook")).toBeNull();
    expect(trustedForwardUrl("ab12cd34ef", null)).toBe(
      "https://wa-ab12cd34ef.agent37.app/whatsapp/webhook"
    );
  });

  it("keeps the shared-number webhook public and isolated from other agents", () => {
    const middleware = read("src/lib/supabase/middleware.ts");
    const route = read("src/app/api/webhooks/whatsapp/route.ts");
    expect(middleware).toContain('pathname.startsWith("/api/webhooks/")');
    expect(route).toContain("verifyMetaSignature");
    expect(route).toContain("owner_phone_e164");
    expect(route).toContain("trustedForwardUrl");
    expect(route).toContain("whatsapp_router_events");
  });
});
