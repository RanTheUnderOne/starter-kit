---
name: source-gmail
description: Read Gmail and return normalized lead events.
version: 0.1.0
author: Ran (RanTheUnderOne), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [gmail, email, inbound, leads, source]
    related_skills: [lead-triage, crm-fireberry]
---

# Gmail source

Read Gmail and return normalized inbound lead events to a business workflow.
Never call CRM tools or send, reply to, forward, archive, label, or mark
customer email as read.

Timezone `Asia/Jerusalem`. **Hebrew only** for CRM fields, notes, and the manager report.

Mailbox: connected Gmail through Composio. The calling workflow selects the
configured mailbox; this source never assumes a fixed account alias.

Do not run the WhatsApp skill. Do not read WhatsApp.

## When to run

Triggers (Hebrew): «סרוק אימייל» / «סרוק מייל» / «תמיין לידים מאימייל» / «עדכן לידים מאימייל».

1. Load Gmail threads and relevant messages.
2. Detect new inbound, unread, changed, and waiting-on-business conversations.
3. Return normalized events to the calling business workflow.
4. Do not access or mutate CRM data.

## Workflow

1. Gmail: `GMAIL_FETCH_EMAILS` with `verbose: false`, `include_payload: false`. Query default: `in:inbox -in:spam -in:trash -category:promotions -category:social newer_than:7d`. Also fetch `is:unread in:inbox` if that query missed unread older than 7 days. Paginate `page_token` until done or a hard cap of 100 threads per run (say so if capped). Sort by `internalDate` / `messageTimestamp` client-side.
2. Skip: the owner’s own address as the only party, `noreply@`, `no-reply@`, `mailer-daemon`, newsletters, receipts, 2FA codes. Skip `CATEGORY_PROMOTIONS` / `CATEGORY_SOCIAL` unless the manager asked to include them.
3. For changed, unread, or new senders, load messages with
   `GMAIL_FETCH_MESSAGE_BY_THREAD_ID`. The newest inbound versus outbound
   message determines who is waiting.
4. Return facts: normalized email, display name and confidence, thread ID,
   timestamps, latest-message direction, factual summary, and message IDs.

## Identity extraction

Resolve a display name from the email header first, then from a signature or
body. Treat a local-part-only sender, automated sender, or the mailbox owner's
name as missing. Otherwise return no name; never invent one.

## Output

```text
{
  "source": "gmail",
  "eventType": "new_inbound | unread | waiting_on_business | changed",
  "occurredAt": "<ISO-8601>",
  "identity": { "name": null, "email": "lead@example.com", "nameConfidence": "missing" },
  "conversation": { "threadId": "<id>", "lastInboundAt": "<ISO-8601>", "lastOutboundAt": "<ISO-8601>" },
  "summary": "<facts only>",
  "evidence": ["<message IDs or timestamps>"]
}
```

## Tools

Gmail: `GMAIL_FETCH_EMAILS`, `GMAIL_LIST_THREADS`,
`GMAIL_FETCH_MESSAGE_BY_THREAD_ID`, and `GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID`.

Never send, reply to, forward, archive, label, or mark Gmail messages as read.
