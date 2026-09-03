# Alfi Production Product Design

**Date:** 2026-09-03  
**Status:** Approved for implementation  
**Canonical repository:** `RanTheUnderOne/starter-kit` (to become the single Alfi product repository)

## Product objective

Ship Alfi as one coherent, production-ready product for non-technical business owners. The customer experience must be bilingual (English LTR and Hebrew RTL), premium, calm, and focused only on work the customer needs to see. Technical controls remain available to authorized Alfi staff.

The product contains exactly two WhatsApp experiences:

1. **Connect your business WhatsApp** — the customer's own WhatsApp Business number, connected through Kapso and exposed to the customer's Alfi through the tenant-scoped Alfi MCP.
2. **Talk to Alfi on WhatsApp** — the business owner's private control conversation through the shared Meta Cloud number, routed by the owner's allowlisted phone number to the correct Hermes instance.

The legacy standalone Wassenger runtime is not part of the consolidated product. Only genuinely provider-neutral business knowledge may be migrated from it.

## Repository ownership

The canonical repository owns the complete product:

- Next.js customer and staff interfaces
- Server/API routes and domain services
- Supabase schema and migrations
- Agent37 provisioning and runtime access
- Kapso MCP and webhook integration
- Shared Meta Cloud WhatsApp router
- Alfi's `SOUL.md`, skills, configuration, and default cron manifest
- Generated Alfi bundle
- Unit, integration, and browser tests
- Deployment and operations documentation

The generated bundle is deterministic across operating systems. Source files are sorted and normalized before generation so a clean build never creates an unexplained Git diff.

## Roles and access

### Customer

Each customer normally opens directly into one Alfi workspace. The primary navigation contains:

- **Alfi** — the main conversation
- **Schedules** — live Hermes scheduled jobs and their results
- **WhatsApp** — the two clearly separated WhatsApp experiences
- **Business** — concise business information and account settings

### Staff

Authorized Alfi staff receive an additional **Advanced** area containing:

- customer and agent fleet management
- files
- model and reasoning controls
- budgets and usage
- lifecycle controls such as restart and delete
- ports and integrations
- provisioning state, diagnostics, and technical errors

Staff access is enforced by server-side authorization, not only hidden in the interface.

## Visual and interaction direction

Use the approved **Direction B — Living Assistant** visual system:

- rich midnight/deep teal, mint, warm cream, charcoal, and restrained amber
- large editorial typography and generous whitespace
- clear activity and status language without infrastructure terminology
- responsive layouts with equivalent English and Hebrew experiences
- persistent language switch
- correct `lang` and `dir` at the document level
- logical-direction spacing and icons that mirror when direction matters
- accessible focus states, contrast, labels, empty states, errors, and loading states

The main customer screen is conversation-first. It does not claim that work was completed unless the current backend can prove it.

## Alfi conversation

The existing Hermes chat remains the primary customer interaction. Customer-facing chat removes model selection, reasoning effort, raw run controls, file management, and other technical concepts. Those controls move to the staff-only Advanced area.

The customer can continue a scheduled result in chat. Selecting **Continue with Alfi** on a result inserts a compact quoted context block into the existing composer, identifies the source job and run, and lets the customer add their own instruction before sending. It does not create a separate conversation unless the customer explicitly starts one.

## Global Alfi bundle

The global Alfi source is product-owned and consists of:

- `SOUL.md`
- skills and their references
- product configuration
- a machine-readable default cron manifest

Customers cannot mutate this repository source or global bundle. The build validates that every default cron references existing skills and produces generated TypeScript consumed by provisioning.

## Cron ownership and synchronization

The repository cron manifest is the source of truth for **new-agent defaults**, not for a customer's live jobs after provisioning.

### Provisioning

For every newly created Alfi, the server uses Agent37 exec to:

1. upload the normalized SOUL and skill bundle;
2. verify required files and skill discovery;
3. create the default cron jobs through supported `hermes cron` commands;
4. verify the expected jobs exist;
5. run cron status and doctor checks;
6. verify the Hermes gateway is healthy;
7. mark provisioning ready only after the complete sequence succeeds.

The initial schedules use `Asia/Jerusalem` for V1. Default job names are stable and namespaced so repeated provisioning is idempotent and cannot create duplicates.

### Customer-owned live jobs

After initial provisioning, the live Hermes cron store belongs to that customer's Alfi. Customers may create, edit, pause, resume, run, and delete jobs through a simple product interface. These changes affect only their instance and never rewrite the global bundle.

The UI reads current state from Hermes rather than from the repository manifest. It presents friendly labels and local times while hiding cron expressions and model/provider configuration unless staff opens Advanced.

### Results

Schedule results use Hermes' real job state, execution history, and saved outputs. The customer sees:

- job name and plain-language purpose
- enabled/paused state
- next run in local time
- last-run state
- recent results
- a clear failure message with a retry or talk-to-Alfi path

Technical errors remain available to staff; customer errors are concise and actionable.

## WhatsApp experience

The WhatsApp screen uses two distinct sections and verbs:

### Connect your business WhatsApp

- starts or resumes the Kapso-hosted setup flow
- shows only customer-relevant connection state and the connected display number
- never exposes Kapso customer IDs, setup IDs, internal webhook URLs, tokens, or provisioning errors
- reports connected only after server-confirmed provider state

### Talk to Alfi on WhatsApp

- captures and verifies the owner's allowlisted phone number
- explains that this is a private owner-to-Alfi channel, not the public business inbox
- opens the shared Alfi WhatsApp conversation when routing is ready
- reports ready only when global Meta configuration, per-agent routing, and Hermes health are all confirmed

No Wassenger path or third WhatsApp product is introduced.

## Reliability and security requirements

Before release:

- shared-router idempotency is released after every non-successful downstream response, not only thrown network errors;
- forwarding URLs are derived and validated against the exact expected Agent37 instance host and path;
- create-agent responses accurately report incomplete or failed provisioning;
- the customer UI never celebrates readiness while provisioning failed;
- WhatsApp browser responses expose an explicit public DTO rather than raw database rows;
- Kapso deletion clears all stale provider fields;
- provider creation retries cannot create duplicate/orphan agents after ambiguous errors;
- generated configuration and secret files use restrictive permissions;
- webhook and routing tests exercise real behavior rather than source-string assertions;
- all tenant-sensitive routes enforce membership and agent ownership server-side.

## Data and API boundaries

- Browser requests pass through authenticated Next.js BFF routes.
- Server routes authorize the workspace and agent before Agent37, Kapso, Meta, or Supabase access.
- Cron management accepts structured, validated fields; it does not accept arbitrary shell commands from the browser.
- Server code constructs and executes a fixed allowlisted Hermes command shape.
- Cron output is treated as untrusted text and rendered safely.
- Customer DTOs omit infrastructure identifiers and raw provider payloads.

## Verification and release

The release is complete only after:

- deterministic bundle generation passes from a clean checkout;
- unit and integration tests pass;
- TypeScript and production build pass;
- both language directions are exercised;
- customer and staff authorization boundaries are tested;
- an agent provision test confirms SOUL, skills, default crons, scheduler health, and Hermes health;
- both WhatsApp setup paths are tested with configured services;
- browser testing covers desktop and mobile customer flows;
- the deployed URL is opened and the production flow is verified end to end.

## Deferred from V1

A new database-backed approval engine and unified activity ledger are intentionally deferred. Existing Alfi safety instructions remain, but the customer UI does not present an approvals center or unverifiable “Today completed” claims.
