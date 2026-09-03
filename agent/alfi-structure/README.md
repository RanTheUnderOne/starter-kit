# Alfi skill bundle

Portable skill bundle for Alfi, a Hebrew-first sales and lead-operations agent
for Israeli businesses. It is not the customer-facing WhatsApp bot.

## Bundle structure

```text
alphi-structure/
├── SOUL.md                         # Identity, scope, and safety boundaries
├── config/
│   ├── mcp.yaml                    # MCP connection configuration
│   └── ENVIRONMENT.md              # Required environment variables
├── skills/
│   ├── sources/                    # Read and normalize source events
│   │   ├── whatsapp/
│   │   └── gmail/
│   ├── business/                   # Owner-facing business workflows
│   │   ├── lead-triage/
│   │   ├── morning-review/
│   │   ├── follow-up-radar/
│   │   └── voice-note-to-action/
│   ├── crm/                        # Provider-neutral contract and adapters
│   │   ├── CRM-CAPABILITY-CONTRACT.md
│   │   └── fireberry/
│   └── whatsapp/                   # Tenant-scoped WhatsApp MCP guidance
│       └── mcp/
├── cron/                           # Scheduled workflow definitions
└── runtime/                        # Installation and loading contract
```

## Layer rules

- `skills/sources/` reads systems and returns normalized events. It never writes
  CRM data or contacts customers.
- `skills/business/` combines source events with CRM capabilities, ranks work,
  and proposes actions for owner approval.
- `skills/crm/` owns CRM-specific fields, tools, mutations, deduplication, and
  read-back verification.
- `skills/whatsapp/` documents the tenant-scoped Alfi WhatsApp MCP. Reading is
  autonomous; customer-facing sends and reactions require owner approval.

## Installation

This repository is source code, not an automatically loaded runtime. See
[`runtime/README.md`](runtime/README.md) for the required installation or
external-directory registration step.
