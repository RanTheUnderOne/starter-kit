---
name: alfi-whatsapp-mcp
description: Safely read and operate the business WhatsApp account through Alfi's tenant-scoped MCP.
version: 1.0.0
author: Ran (RanTheUnderOne), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [whatsapp, kapso, mcp, inbox]
    related_skills: [source-whatsapp, lead-triage]
---

# Alfi WhatsApp MCP

Use the `alfi_whatsapp` MCP for the WhatsApp Business number assigned to this
agent. The server enforces the assignment; never ask for or guess a
`phone_number_id`.

## Connection

Start with `whatsapp_connection_status`.

- `connected`: WhatsApp tools are available.
- `not_connected`: tell the owner to open this agent's Settings page and choose
  **Connect WhatsApp**. Do not repeatedly retry.
- `revoked`: access was disabled; ask an administrator to reconnect it.

## Read tools

- `whatsapp_list_conversations`: browse conversations, optionally filtered by
  status, contact identity, or pagination.
- `whatsapp_get_conversation`: load one conversation by ID.
- `whatsapp_list_messages`: read messages for a conversation or contact.
- `whatsapp_get_message`: load one message by ID.
- `whatsapp_list_templates`: list approved WhatsApp templates.

Read and summarize autonomously. Preserve message IDs, timestamps, direction,
and the contact identity as evidence. A phone number may be absent when Meta
uses a business-scoped user ID.

## Customer-facing tools

- `whatsapp_send_message`: send text or a supported raw WhatsApp payload.
- `whatsapp_send_template`: send an approved template.
- `whatsapp_react`: react to a specific message.
- `whatsapp_mark_read`: mark an inbound message read.

Reading and marking read are low risk. Sending text, templates, or reactions
requires explicit owner approval for the exact recipient and content in the
current conversation. Approval for one recipient or message does not authorize
another. Show a concise preview before requesting approval.

Never claim success until the tool returns a WhatsApp message ID. If Kapso
rejects a send because the service window is closed, list approved templates
and propose one instead of retrying free-form text.

## Examples

To inspect an inbox:

1. `whatsapp_connection_status`
2. `whatsapp_list_conversations` with `limit: 20`
3. `whatsapp_list_messages` for the relevant conversation
4. Return a factual summary with evidence IDs

To reply:

1. Read the current conversation.
2. Draft the exact response and ask the owner to approve it.
3. After explicit approval, call `whatsapp_send_message`.
4. Report the returned message ID and recipient.

To use a template:

1. `whatsapp_list_templates`
2. Select an approved template and prepare its variables.
3. Ask the owner to approve recipient, template, and resolved variables.
4. Call `whatsapp_send_template` once.

## Failure handling

- Do not expose MCP tokens, Kapso credentials, headers, or internal IDs.
- Do not retry authentication, revocation, or validation errors.
- Retry a transient rate-limit or upstream error at most once after the
  indicated delay.
- If identity is ambiguous, ask the owner rather than contacting a guessed
  recipient.
