# Alphi Cron Jobs & Routines

This directory defines the automated schedules and recurring routines for Alfi (the Master Agent).
These jobs run autonomously via Hermes Cron and deliver action items directly to the business owner.

## Jobs Overview

| Job Name | Schedule | Skills Used | Objective | Delivery Target |
|---|---|---|---|---|
| `morning-sales-review` | `0 8 * * 0-4` (Sun-Thu 08:00 IL) | `morning-review`, `lead-triage`, `source-whatsapp`, `source-gmail`, `crm-fireberry` | Scan WhatsApp & Gmail, deduplicate through the CRM adapter, and deliver a unified briefing with proposed next steps. | `telegram` (Home Channel) |
| `evening-pipeline-audit` | `0 18 * * 0-4` (Sun-Thu 18:00 IL) | `lead-triage`, `follow-up-radar` | Identify leads still waiting for a reply, summarize daily inbound, and flag proposed actions. | `telegram` (Home Channel) |

---

## 1. Morning Sales Review (`morning-sales-review`)
- **When:** Every business day at 08:00 AM (Israel Time).
- **Core Mission:**
  1. Invoke `morning-review`, which invokes `lead-triage`.
  2. Read WhatsApp and Gmail through `source-whatsapp` and `source-gmail`.
  3. Match contacts and deduplicate through the active CRM adapter.
  4. Format output following Alfi's SOUL:
     - **Summary:** Total inbound items found.
     - **Urgent / Unanswered:** Leads requiring immediate callback/response today.
     - **CRM Status:** Existing matches vs. new prospective leads.
     - **Proposed Actions (Pending Approval):** Numbered list of concrete actions for the owner to approve (e.g. `[1] Create Fireberry lead for X`, `[2] Update deal stage for Y`).
  5. Deliver to owner's Telegram channel. Never message end customers directly
     or mutate CRM data without approval.
