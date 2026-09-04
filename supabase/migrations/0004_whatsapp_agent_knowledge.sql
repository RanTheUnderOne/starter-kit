-- Immutable, tenant-scoped knowledge snapshots for the Kapso WhatsApp Agent.
-- Updating the active pointer affects new workflow executions only; Kapso keeps the
-- workflow-definition snapshot that each running/waiting execution started with.

create table if not exists public.agent_whatsapp_profiles (
  agent37_id                   text primary key references public.agents (agent37_id) on delete cascade,
  workspace_id                 uuid not null references public.workspaces (id) on delete cascade,
  business_name                text not null default '',
  description                  text not null default '',
  services                     jsonb not null default '[]'::jsonb,
  hours                        text not null default '',
  service_areas                jsonb not null default '[]'::jsonb,
  languages                    jsonb not null default '[]'::jsonb,
  tone                         text not null default '',
  approved_pricing_facts       jsonb not null default '[]'::jsonb,
  faqs                         jsonb not null default '[]'::jsonb,
  escalation_policy            text not null default '',
  forbidden_claims             jsonb not null default '[]'::jsonb,
  owner_notification_target    text not null default '',
  updated_at                   timestamptz not null default now()
);

create table if not exists public.agent_whatsapp_knowledge_sources (
  id             uuid primary key default gen_random_uuid(),
  agent37_id     text not null references public.agents (agent37_id) on delete cascade,
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  source_kind    text not null check (source_kind in ('text', 'url', 'file')),
  label          text not null,
  media_type     text not null,
  source_url     text,
  content        text,
  content_digest text,
  provenance     jsonb not null default '{}'::jsonb,
  status         text not null default 'processing'
                 check (status in ('processing', 'ready', 'failed', 'removed')),
  last_error     text,
  last_synced_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (content is null or char_length(content) <= 120000)
);

create index if not exists agent_whatsapp_knowledge_sources_agent_idx
  on public.agent_whatsapp_knowledge_sources (agent37_id, status, created_at);
create unique index if not exists agent_whatsapp_knowledge_source_digest_idx
  on public.agent_whatsapp_knowledge_sources (agent37_id, content_digest)
  where content_digest is not null and status <> 'removed';

create table if not exists public.agent_whatsapp_knowledge_versions (
  agent37_id     text not null references public.agents (agent37_id) on delete cascade,
  version        integer not null check (version > 0),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  profile        jsonb not null,
  sources        jsonb not null,
  compiled_prompt text not null,
  created_at     timestamptz not null default now(),
  primary key (agent37_id, version)
);

alter table public.agent_whatsapp_connections
  add column if not exists active_knowledge_version integer,
  add column if not exists synced_knowledge_version integer,
  add column if not exists knowledge_last_synced_at timestamptz,
  add column if not exists knowledge_last_error text,
  add column if not exists sandbox_tested_at timestamptz;

alter table public.agent_whatsapp_profiles enable row level security;
alter table public.agent_whatsapp_knowledge_sources enable row level security;
alter table public.agent_whatsapp_knowledge_versions enable row level security;
revoke all on public.agent_whatsapp_profiles from anon, authenticated;
revoke all on public.agent_whatsapp_knowledge_sources from anon, authenticated;
revoke all on public.agent_whatsapp_knowledge_versions from anon, authenticated;
grant select, insert, update, delete on public.agent_whatsapp_profiles to service_role;
grant select, insert, update, delete on public.agent_whatsapp_knowledge_sources to service_role;
grant select, insert on public.agent_whatsapp_knowledge_versions to service_role;

create or replace function public.publish_whatsapp_knowledge(
  p_agent37_id text,
  p_workspace_id uuid,
  p_expected_active_version integer,
  p_profile jsonb,
  p_sources jsonb,
  p_compiled_prompt text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current integer;
  v_next integer;
begin
  select active_knowledge_version
    into v_current
    from public.agent_whatsapp_connections
   where agent37_id = p_agent37_id
     and workspace_id = p_workspace_id
   for update;

  if not found then
    raise exception 'WhatsApp connection not found' using errcode = 'P0002';
  end if;

  if v_current is distinct from p_expected_active_version then
    raise exception 'Knowledge version conflict' using errcode = '40001';
  end if;

  v_next := coalesce(v_current, 0) + 1;
  insert into public.agent_whatsapp_knowledge_versions (
    agent37_id, version, workspace_id, profile, sources, compiled_prompt
  ) values (
    p_agent37_id, v_next, p_workspace_id, p_profile, p_sources, p_compiled_prompt
  );

  update public.agent_whatsapp_connections
     set active_knowledge_version = v_next,
         knowledge_last_error = null,
         updated_at = now()
   where agent37_id = p_agent37_id;

  return v_next;
end;
$$;

revoke all on function public.publish_whatsapp_knowledge(text, uuid, integer, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.publish_whatsapp_knowledge(text, uuid, integer, jsonb, jsonb, text)
  to service_role;
