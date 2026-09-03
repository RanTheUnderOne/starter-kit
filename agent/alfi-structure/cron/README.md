# Alfi Cron Jobs & Routines

`jobs.json` is the machine-readable source of truth for the default jobs installed
when a new Alfi is provisioned. These defaults run through Hermes Cron and save
their results locally so the Alfi product can display them.

After provisioning, a customer's live jobs belong to that customer's Hermes
instance. Customer changes never modify this global manifest.

## Jobs Overview

| Job Name | Schedule | Skills Used | Objective | Delivery Target |
|---|---|---|---|---|
| `alfi:morning-sales-review` | `0 8 * * 0-4` (Sun-Thu 08:00 IL) | `business/morning-review`, `business/lead-triage`, `sources/whatsapp`, `sources/gmail`, `crm/fireberry` | Scan WhatsApp and Gmail, deduplicate through the CRM adapter, and save a unified briefing with proposed next steps. | `local` |
| `alfi:evening-pipeline-audit` | `0 18 * * 0-4` (Sun-Thu 18:00 IL) | `business/lead-triage`, `business/follow-up-radar` | Identify leads still waiting for a reply, summarize daily inbound, and propose next actions. | `local` |

---

## 1. Morning Sales Review (`alfi:morning-sales-review`)
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
  5. Save the result to the Hermes cron output store for the Alfi product. Never
     message end customers directly or mutate CRM data without approval.
