-- Tenant-scoped idempotency and audit trail for WhatsApp Agent MCP mutations.
-- Inputs and credentials are intentionally not stored. Results contain only the
-- narrow, secret-free response envelopes produced by the administration tools.

create table if not exists public.agent_whatsapp_mcp_audit (
  id             uuid primary key default gen_random_uuid(),
  agent37_id     text not null references public.agents (agent37_id) on delete cascade,
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  tool_name      text not null check (char_length(tool_name) between 1 and 100),
  request_id     text not null check (char_length(request_id) between 8 and 128),
  status         text not null check (status in ('started', 'succeeded', 'failed')),
  result         jsonb,
  error_message  text check (error_message is null or char_length(error_message) <= 1000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  completed_at   timestamptz,
  unique (agent37_id, tool_name, request_id)
);

create index if not exists agent_whatsapp_mcp_audit_tenant_idx
  on public.agent_whatsapp_mcp_audit (workspace_id, agent37_id, created_at desc);

alter table public.agent_whatsapp_mcp_audit enable row level security;
revoke all on public.agent_whatsapp_mcp_audit from anon, authenticated;
grant select, insert, update, delete on public.agent_whatsapp_mcp_audit to service_role;
