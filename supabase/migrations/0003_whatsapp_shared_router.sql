alter table public.agent_whatsapp_connections
  add column if not exists owner_phone_e164 text,
  add column if not exists webhook_url text;

create unique index if not exists agent_whatsapp_owner_phone_idx
  on public.agent_whatsapp_connections (owner_phone_e164)
  where owner_phone_e164 is not null;

create table if not exists public.whatsapp_router_events (
  idempotency_key text primary key,
  agent37_id      text,
  received_at     timestamptz not null default now()
);

alter table public.whatsapp_router_events enable row level security;
revoke all on public.whatsapp_router_events from anon, authenticated;
grant select, insert, update, delete on public.whatsapp_router_events to service_role;
