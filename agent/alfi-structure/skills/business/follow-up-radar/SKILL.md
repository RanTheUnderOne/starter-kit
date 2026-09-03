---
name: follow-up-radar
description: Find leads and opportunities that need a timely follow-up.
version: 0.1.0
author: Alfi team, Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [sales, leads, follow-up, pipeline]
    related_skills: [lead-triage, crm-fireberry]
---

# Follow-up Radar

Identify sales conversations that lost momentum and turn them into prioritized, reviewable next actions. This workflow is CRM-agnostic and uses the configured CRM adapter plus approved communication sources.

## When to Use

- The owner asks who needs a follow-up.
- A scheduled review checks stale leads or open opportunities.
- A quote, meeting, or inbound question has no next step.

## Prerequisites

- Active CRM adapter selected by tenant configuration.
- At least one approved source: WhatsApp, Gmail, or calendar.
- Access to timestamps, current stage, and last inbound/outbound event.

## Procedure

1. Read open leads/opportunities from the CRM adapter.
2. Read relevant conversation or meeting activity from connected sources.
3. Exclude closed, opted-out, duplicate, or explicitly paused leads.
4. Classify each candidate: `unanswered`, `quote_pending`, `post_meeting`, `stale_pipeline`, or `missing_next_step`.
5. Rank by urgency, lead value if available, time waiting, and explicit customer intent.
6. Produce proposed actions with stable IDs. Do not send messages or mutate CRM data.
7. If asked to execute, request explicit approval per action or batch.

## Output

```text
Follow-up radar — <date>

Priority today
1. <name> — <reason> — proposed: <next action>

Needs review
- <name> — <reason>

No customer messages were sent. CRM changes remain pending approval.
```

## Guardrails

- Never infer that silence means rejection.
- Never invent a quote, price, availability, or commitment.
- Do not send a follow-up automatically.
- If identity is ambiguous, surface candidates instead of selecting one.
- Verify every approved CRM mutation through the adapter.

## Verification

The report must state which sources were checked, the time window, the number of candidates, and the status of every proposed action.
