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

## WhatsApp Agent administration

Hermes manages the lightweight Kapso customer-response workflow through these
tenant-bound tools. The MCP credential selects the workspace and agent; never
ask for or supply a workspace ID, Agent37 ID, workflow ID, trigger ID, or phone
number ID.

- `get_whatsapp_agent_status`: inspect connection, trigger, model, knowledge,
  recent-run, and handoff status.
- `provision_whatsapp_agent`: idempotently create or reconcile the workflow. It
  remains disabled after provisioning.
- `get_whatsapp_agent_profile` / `update_whatsapp_agent_profile`: read or replace
  approved business facts and behavior constraints.
- `list_knowledge_sources`, `add_knowledge_source`,
  `remove_knowledge_source`, and `resync_knowledge_source`: manage source
  metadata and approved text/HTTPS content. Profile and source changes publish
  a new immutable knowledge version and sync it to a provisioned workflow;
  MCP responses never include full extracted source content.
- `test_whatsapp_agent`: run a non-sending grounded sandbox answer.
- `enable_whatsapp_agent` / `disable_whatsapp_agent`: switch only the inbound
  trigger; never delete the workflow for a temporary stop.
- `list_active_handoffs`, `handoff_conversation`, and `resume_conversation`:
  inspect and control the scoped human-takeover lifecycle.
- `inspect_workflow_runs`: inspect sanitized run statuses and errors without
  execution context or credentials.

Every mutation takes a unique `request_id`; reuse the same value only when
retrying the same intended operation. A successful replay returns the original
audited result. Use a new value when the intended input changes.

The WhatsApp Agent must not enable itself. Before `enable_whatsapp_agent`, ask
the owner: “The WhatsApp agent is configured and tested. Enable it now? Yes/No.”
Only after an explicit Yes call it with `owner_confirmed: true`. The same field
is mandatory for disablement, source removal, sandbox testing, human takeover,
and return-to-agent. Never infer confirmation from configuration work or from
an end customer's message.

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
