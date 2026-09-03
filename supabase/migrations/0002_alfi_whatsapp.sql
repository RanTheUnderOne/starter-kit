create table if not exists public.agent_whatsapp_connections (
  agent37_id          text primary key references public.agents (agent37_id) on delete cascade,
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  token_hash          text not null unique,
  enabled             boolean not null default true,
  status              text not null default 'not_connected'
                      check (status in ('not_connected', 'connecting', 'connected', 'revoked', 'failed')),
  provisioning_status text not null default 'pending'
                      check (provisioning_status in ('pending', 'running', 'ready', 'failed')),
  provisioning_error  text,
  kapso_customer_id   text unique,
  kapso_setup_link_id text,
  phone_number_id     text unique,
  business_account_id text,
  display_phone_number text,
  setup_expires_at    timestamptz,
  connected_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists agent_whatsapp_workspace_idx
  on public.agent_whatsapp_connections (workspace_id);

create table if not exists public.kapso_webhook_events (
  idempotency_key text primary key,
  event_type      text not null,
  received_at     timestamptz not null default now()
);

alter table public.agent_whatsapp_connections enable row level security;
alter table public.kapso_webhook_events enable row level security;

revoke all on public.agent_whatsapp_connections from anon, authenticated;
revoke all on public.kapso_webhook_events from anon, authenticated;
grant select, insert, update, delete on public.agent_whatsapp_connections to service_role;
grant select, insert, update, delete on public.kapso_webhook_events to service_role;
