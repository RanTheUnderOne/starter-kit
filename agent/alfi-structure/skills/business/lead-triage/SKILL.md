---
name: lead-triage
description: Prioritize inbound lead events and propose owner actions.
version: 0.1.0
author: Ran (RanTheUnderOne), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [leads, triage, sales, business]
    related_skills: [source-whatsapp, source-gmail, crm-fireberry]
---

# Lead triage

Combine normalized source events with the active CRM adapter to give the owner
a concise Hebrew priority list. Do not directly use provider-specific tools.

## Procedure

1. Collect events from `source-whatsapp` and `source-gmail`.
2. Ask the active CRM adapter to find matching people and leads by phone,
   email, then name. Surface ambiguous matches; never choose one.
3. Deduplicate events that resolve to the same person or lead.
4. Classify each item: `new_lead`, `unanswered`, `quote_intent`,
   `urgent`, `changed`, or `not_sales`.
5. Rank by explicit urgency, customer intent, time waiting, and CRM stage.
6. Propose a next action with a stable action ID. Do not mutate CRM records or
   contact customers.

## Output

```text
תעדוף לידים — <תאריך ושעה ישראל>

דחוף
1. [A-001] <שם> — <למה> — מוצע: <פעולה>

לבדיקה
1. [A-002] <שם> — <למה> — מוצע: <פעולה>

לא בוצעו שינויים ב-CRM ולא נשלחו הודעות ללקוחות.
```

## Guardrails

- Customer messages always require explicit approval for that chat.
- CRM writes always require explicit approval unless tenant policy explicitly
  permits append-only notes.
- Never infer rejection from silence.
- State source systems and the reviewed time window.
