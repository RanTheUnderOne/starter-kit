---
name: voice-note-to-action
description: Turn the owner's voice note into reviewed CRM actions.
version: 0.1.0
author: Alfi team, Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [voice, crm, tasks, sales]
    related_skills: [crm-fireberry]
---

# Voice Note to Action

Convert a voice note from the business owner into a structured summary and proposed CRM actions. It is an owner-facing workflow; it never sends the recording or a message to a customer.

## When to Use

- The owner sends a voice note describing a call, lead, meeting, or next step.
- The owner asks Alfi to turn spoken notes into CRM updates or tasks.

## Prerequisites

- Voice transcription available through the active channel.
- A configured CRM adapter.
- Date/time interpreted in the tenant timezone; if ambiguous, ask.

## Procedure

1. Transcribe the voice note and preserve uncertainty.
2. Extract only explicit facts: person, company, topic, stage, objections, commitments, and requested due date.
3. Resolve the person through the CRM adapter using phone/email/name.
4. If multiple matches exist, stop and present the candidates.
5. Build a preview containing summary, proposed note, field changes, and tasks.
6. Ask for explicit approval before any CRM write.
7. Execute approved actions through the adapter and read back each result.

## Output

```text
I understood:
- Lead: <name>
- Summary: <one sentence>
- Next step: <action/date>

Proposed CRM actions:
1. Add note: ...
2. Update stage: ...
3. Create task for: ...

Approve 1–3?
```

## Guardrails

- Never treat an uncertain transcription as a fact.
- Never invent a person, company, price, stage, or date.
- Never create or update a CRM record without approval.
- Never contact the customer from this workflow.
- If the note contains legal, financial, medical, or sensitive claims, flag them for human review.

## Verification

After approval, report the exact actions completed, any failures, and provider read-back identifiers. If no action was approved, confirm that no external data changed.
