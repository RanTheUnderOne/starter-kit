---
name: source-whatsapp
description: Read business WhatsApp and return normalized lead events.
version: 0.1.0
author: Ran (RanTheUnderOne), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [whatsapp, inbound, leads, source]
    related_skills: [lead-triage, crm-fireberry, alfi-whatsapp-mcp]
---

# WhatsApp source

Read WhatsApp and return normalized inbound lead events to a business workflow.
Never call CRM tools or contact a customer. The customer bot is a separate app.

Timezone `Asia/Jerusalem`. **Hebrew only** for CRM fields, notes, and the manager report.

## When to run

Triggers (Hebrew): «סרוק וואטסאפ» / «תמיין כלידים» / «עדכן לידים».

1. Load WhatsApp chats and messages.
2. Detect new inbound, unread, changed, and waiting-on-business conversations.
3. Return normalized events to the calling business workflow.
4. Do not access or mutate CRM data.

## Workflow

1. Call `whatsapp_connection_status`. If it reports `not_connected` or `revoked`, stop and explain that the owner must connect WhatsApp in Alfi Settings.
2. Call `whatsapp_list_conversations` with a conservative page size. Focus on unread, active, recently changed, and waiting-on-business conversations.
3. For relevant conversations, call `whatsapp_list_messages` with the conversation ID. Use each message's direction and timestamp; do not infer direction from prose.
4. Skip groups, the business number, personal chats, and bot tests when those facts are available.
5. Return facts: normalized phone or business-scoped user ID, display name and confidence, conversation ID, timestamps, latest-message direction, factual summary, and supporting message IDs.

## Identity extraction

Resolve a display name in this order:

1. Chat/contact `name`, `contact.name`, or `contact.displayName`. Treat a
   number, a phone-like name, or the business owner's name as missing.
2. A name explicitly stated in the chat or used in an outbound greeting.
3. Otherwise return no name and identify the lead only by normalized phone.

## Output

```text
{
  "source": "whatsapp",
  "eventType": "new_inbound | unread | waiting_on_business | changed",
  "occurredAt": "<ISO-8601>",
  "identity": { "name": null, "phone": "+972...", "nameConfidence": "missing" },
  "conversation": { "chatId": "<wid>", "lastInboundAt": "<ISO-8601>", "lastOutboundAt": "<ISO-8601>" },
  "summary": "<facts only>",
  "evidence": ["<message IDs or timestamps>"]
}
```

## Tools

Alfi WhatsApp MCP: `whatsapp_connection_status`,
`whatsapp_list_conversations`, `whatsapp_get_conversation`,
`whatsapp_list_messages`, and `whatsapp_get_message`.

Never call a send or reaction tool from this source. Customer-facing actions
must follow the approval rules in `alfi-whatsapp-mcp`.
