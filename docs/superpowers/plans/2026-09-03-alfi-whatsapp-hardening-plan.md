# Alfi WhatsApp and Server Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both supported WhatsApp paths reliable, tenant-safe, and customer-ready without exposing provider infrastructure.

**Architecture:** Pure routing and DTO helpers carry the correctness rules and receive focused tests. Route handlers authenticate, validate, and call those helpers. The customer WhatsApp screen consumes an explicit public status model with separate business-number and owner-channel readiness.

**Tech Stack:** Next.js route handlers, TypeScript, Supabase, Agent37, Kapso, Meta Cloud API, Vitest.

## Global Constraints

- Exactly two WhatsApp tracks: Kapso business number and shared Meta owner channel.
- No Wassenger runtime or third provider path.
- Non-successful forwarding must remain retryable.
- Stored forwarding URLs must match the exact owning Agent37 instance.
- Browser DTOs contain no secrets or internal provider identifiers.

---

### Task 1: Shared router correctness

**Files:**
- Modify: `src/lib/whatsapp-router.ts`
- Modify: `src/app/api/webhooks/whatsapp/route.ts`
- Create: `tests/whatsapp-router-route.test.ts`
- Modify: `tests/alfi-whatsapp.test.ts`

**Interfaces:**
- Produces: `trustedForwardUrl(agentId, storedUrl)` that accepts only the exact expected URL
- Produces: per-message idempotency keys for a single-sender batch

- [ ] **Step 1: Write failing regression tests**

```ts
test("rejects another agent's otherwise valid webhook URL", () => {
  expect(trustedForwardUrl("agent-a", "https://wa-agent-b.agent37.app/whatsapp/webhook")).toBeNull();
});

test("releases every claimed message id when Hermes returns 500", async () => {
  const result = await forwardSharedWebhook(fixtureWithTwoMessages(), downstream(500));
  expect(result.releasedIds).toEqual(["wamid.1", "wamid.2"]);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/whatsapp-router-route.test.ts`  
Expected: FAIL because cross-agent URLs are trusted and non-2xx responses keep the dedupe claim.

- [ ] **Step 3: Implement exact routing and retry semantics**

Require protocol, hostname, default port, path, empty query/hash, and the exact URL derived from the owning agent ID. Claim every message ID atomically, release all claims on network error or any non-2xx downstream response, and return a retryable 502 to Meta.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/whatsapp-router-route.test.ts tests/alfi-whatsapp.test.ts`  
Expected: PASS for signature, unknown sender, duplicate delivery, multiple IDs, 2xx, 4xx/5xx, timeout, and URL ownership.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp-router.ts src/app/api/webhooks/whatsapp/route.ts tests
git commit -m "fix: make shared WhatsApp routing retry-safe"
```

### Task 2: Public WhatsApp status and truthful readiness

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/whatsapp-connections.ts`
- Modify: `src/lib/whatsapp-gateway.ts`
- Modify: `src/app/api/agents/[id]/whatsapp/status/route.ts`
- Modify: `src/app/api/agents/[id]/whatsapp/allowlist/route.ts`
- Create: `tests/whatsapp-public-status.test.ts`

**Interfaces:**
- Produces: `WhatsAppCustomerStatus = { business, ownerChannel }`
- `business` exposes only status, display number, and actionable setup state
- `ownerChannel` exposes only normalized owner phone and confirmed readiness

- [ ] **Step 1: Write failing DTO tests**

```ts
test("customer WhatsApp status omits provider and router internals", () => {
  const value = customerWhatsAppStatus(connectionFixture(), { cloudConfigured: true });
  expect(JSON.stringify(value)).not.toMatch(/kapso|token|webhook_url|business_account_id|phone_number_id/);
});

test("owner channel is not ready when global Meta configuration is missing", () => {
  expect(customerWhatsAppStatus(connectionFixture({ owner_phone_e164: "+972501234567" }), { cloudConfigured: false }).ownerChannel.ready).toBe(false);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/whatsapp-public-status.test.ts`  
Expected: FAIL because the current public response is the raw row minus only `token_hash`.

- [ ] **Step 3: Implement public DTO and fail-closed configuration**

Require all four Meta values before configuring the owner channel, set `.env` permissions to `0600`, restart/start Hermes, confirm health, then return ready. Treat a zero-row allowlist update as an error.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/whatsapp-public-status.test.ts`  
Expected: PASS for missing configuration, provisioning failures, connected business number, revoked state, and DTO secrecy.

- [ ] **Step 5: Commit**

```bash
git add src/lib src/app/api/agents/[id]/whatsapp tests/whatsapp-public-status.test.ts
git commit -m "fix: report truthful WhatsApp readiness"
```

### Task 3: Kapso lifecycle and provisioning integrity

**Files:**
- Modify: `src/app/api/webhooks/kapso/route.ts`
- Modify: `src/app/api/agents/[id]/whatsapp/setup/route.ts`
- Modify: `src/app/api/agents/[id]/whatsapp/reconcile/route.ts`
- Modify: `src/app/api/agents/route.ts`
- Create: `tests/kapso-lifecycle.test.ts`
- Create: `tests/agent-create.test.ts`

**Interfaces:**
- Produces: deterministic Kapso setup reuse for an existing customer
- Produces: accurate create-agent failure response

- [ ] **Step 1: Write failing lifecycle tests**

```ts
test("Kapso deletion clears every stale provider field", () => {
  expect(kapsoDeletedPatch()).toMatchObject({
    status: "revoked",
    enabled: false,
    phone_number_id: null,
    business_account_id: null,
    display_phone_number: null,
    connected_at: null,
  });
});

test("agent creation does not report 201 when Alfi provisioning fails", async () => {
  expect((await createAgentWithProvisionFailure()).status).toBeGreaterThanOrEqual(500);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/kapso-lifecycle.test.ts tests/agent-create.test.ts`  
Expected: FAIL because stale fields remain and create hides provisioning failure.

- [ ] **Step 3: Implement lifecycle corrections**

Clear all provider state on deletion, reuse unexpired setup links, serialize first customer creation through a database transition, retry Agent37 creation without public ports only for the documented unsupported-port error, and return an accurate incomplete status if the tracked agent must remain for staff recovery.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/kapso-lifecycle.test.ts tests/agent-create.test.ts`  
Expected: PASS for duplicate setup requests, deletion, webhook database failure, supported fallback, ambiguous Agent37 failure, and provisioning failure.

- [ ] **Step 5: Commit**

```bash
git add src/app/api tests/kapso-lifecycle.test.ts tests/agent-create.test.ts
git commit -m "fix: harden Alfi provisioning lifecycle"
```

### Task 4: Two-track customer WhatsApp UI

**Files:**
- Modify: `src/components/WhatsAppStatusSection.tsx`
- Modify: `src/components/AgentWorkspace.tsx`
- Modify: `src/lib/i18n.ts`
- Create: `tests/whatsapp-copy.test.ts`

**Interfaces:**
- Consumes: `WhatsAppCustomerStatus`
- Presents: “Connect your business WhatsApp” and “Talk to Alfi on WhatsApp” as distinct cards

- [ ] **Step 1: Write failing copy-boundary test**

```ts
test("customer copy distinguishes the public business inbox from the private owner channel", () => {
  expect(messages.en.whatsappBusinessTitle).toBe("Connect your business WhatsApp");
  expect(messages.en.whatsappOwnerTitle).toBe("Talk to Alfi on WhatsApp");
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/whatsapp-copy.test.ts`  
Expected: FAIL because customer dictionaries and final copy do not exist.

- [ ] **Step 3: Implement the approved two-card experience**

Use customer-only status, action-focused explanation, a themed Kapso setup button, a verified owner-number form, and an Open WhatsApp action only when routing is confirmed ready. Keep provider names and internal errors out of customer copy.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/whatsapp-copy.test.ts` and `npm run typecheck`  
Expected: PASS in both locales.

- [ ] **Step 5: Commit**

```bash
git add src/components/WhatsAppStatusSection.tsx src/components/AgentWorkspace.tsx src/lib/i18n.ts tests/whatsapp-copy.test.ts
git commit -m "feat: clarify Alfi WhatsApp setup"
```

