# CRM Capability Contract

This contract is the CRM-agnostic interface used by Alfi business workflows.
Workflows must request capabilities by intent, never by provider-specific API names.

## Required capabilities

| Capability | Purpose | Approval |
|---|---|---|
| `find_person` | Find a person by phone, email, or name | Read-only |
| `find_lead` | Find an existing lead/deal and its current stage | Read-only |
| `get_pipeline` | Read current open leads and stages | Read-only |
| `create_lead` | Create a person/company/lead record | Required |
| `update_lead` | Update a lead's fields or stage | Required |
| `add_note` | Add a dated activity note to the lead | Required by default |
| `create_task` | Create a follow-up task with owner and due date | Required |

## Rules

1. Every adapter must return stable normalized objects, not provider-specific payloads.
2. Search results must include a confidence score and the matched fields.
3. Ambiguous identity matches must be returned for human selection; never merge automatically.
4. Mutations must be idempotent where the provider supports an external reference.
5. A successful mutation must be read back before the workflow reports success.
6. Missing provider capabilities must be reported explicitly; do not silently substitute a different action.

## Normalized objects

```json
{
  "person": { "id": "", "name": "", "emails": [], "phones": [], "companyId": "" },
  "lead": { "id": "", "personId": "", "companyId": "", "stage": "", "source": "", "updatedAt": "" },
  "action": { "id": "", "type": "", "targetId": "", "requiresApproval": true, "status": "proposed" }
}
```

## Adapter selection

The active adapter is selected from tenant configuration (`crm.provider`). A workflow must not infer a provider from a tool name or hardcode account aliases.

Current implementation: `crm-fireberry`.
Planned adapters are added only when a real customer/use case requires them.

## Approval policy

- Reads and analysis: allowed.
- Create/update/note/task: propose first and require explicit approval unless the tenant policy says otherwise.
- Customer-facing messages: always require explicit approval.
- Delete/merge: out of scope by default.

## Error states

Adapters use these normalized error classes:

- `not_connected`
- `not_found`
- `ambiguous_match`
- `validation_error`
- `permission_denied`
- `rate_limited`
- `provider_error`
- `verification_failed`

The user-facing workflow explains the provider-neutral error and names the provider only when useful.

## See also

- `crm-fireberry/SKILL.md`
- `../SOUL.md`
- `../cron/README.md`

---

This is a design contract. It does not itself call a CRM or change external data.

