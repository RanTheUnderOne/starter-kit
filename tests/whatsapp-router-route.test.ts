import { describe, expect, test } from "vitest";
import {
  forwardSharedWebhook,
  trustedForwardUrl,
} from "../src/lib/whatsapp-router";

function fixtureWithTwoMessages() {
  return {
    messageIds: ["wamid.1", "wamid.2"],
    targetUrl: "https://wa-agent-a.agent37.app/whatsapp/webhook",
    rawBody: '{"entry":[]}',
    signature: null as string | null,
  };
}

function downstream(status: number) {
  return async () => new Response("downstream", { status });
}

describe("shared WhatsApp forwarding", () => {
  test("rejects another agent's otherwise valid webhook URL", () => {
    expect(trustedForwardUrl("agent-a", "https://wa-agent-b.agent37.app/whatsapp/webhook")).toBeNull();
  });

  test("releases every claimed message id when Hermes returns 500", async () => {
    const result = await forwardSharedWebhook(fixtureWithTwoMessages(), downstream(500));
    expect(result.releasedIds).toEqual(["wamid.1", "wamid.2"]);
    expect(result.status).toBe(502);
  });
});
