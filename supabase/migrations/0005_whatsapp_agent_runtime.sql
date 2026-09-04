-- Tenant-scoped Kapso workflow runtime identifiers and handoff audit state.

alter table public.agent_whatsapp_connections
  add column if not exists kapso_workflow_id text,
  add column if not exists kapso_trigger_id text,
  add column if not exists workflow_status text
    check (workflow_status is null or workflow_status in ('draft', 'active', 'archived')),
  add column if not exists trigger_active boolean not null default false,
  add column if not exists provider_model_id text,
  add column if not exists provider_model_name text,
  add column if not exists workflow_provisioned_at timestamptz,
  add column if not exists workflow_last_synced_at timestamptz,
  add column if not exists workflow_last_error text;

create unique index if not exists agent_whatsapp_kapso_workflow_idx
  on public.agent_whatsapp_connections (kapso_workflow_id)
  where kapso_workflow_id is not null;
create unique index if not exists agent_whatsapp_kapso_trigger_idx
  on public.agent_whatsapp_connections (kapso_trigger_id)
  where kapso_trigger_id is not null;

create table if not exists public.agent_whatsapp_handoffs (
  workflow_execution_id       text primary key,
  agent37_id                  text not null references public.agents (agent37_id) on delete cascade,
  workspace_id                uuid not null references public.workspaces (id) on delete cascade,
  kapso_workflow_id           text not null,
  whatsapp_conversation_id   text,
  reason                      text,
  source                      text,
  status                      text not null default 'handoff'
                              check (status in ('handoff', 'resumed', 'ended')),
  occurred_at                 timestamptz not null,
  resumed_at                  timestamptz,
  updated_at                  timestamptz not null default now()
);

create index if not exists agent_whatsapp_handoffs_active_idx
  on public.agent_whatsapp_handoffs (agent37_id, status, occurred_at desc);

alter table public.agent_whatsapp_handoffs enable row level security;
revoke all on public.agent_whatsapp_handoffs from anon, authenticated;
grant select, insert, update, delete on public.agent_whatsapp_handoffs to service_role;
