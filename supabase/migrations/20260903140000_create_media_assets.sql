create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) not null,
  entity_type text not null check (entity_type in ('demand', 'task', 'post')),
  entity_id bigint not null,
  bucket text not null,
  object_key text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  status text not null default 'pending' check (status in ('pending', 'ready', 'deleted')),
  uploaded_by_type text not null check (uploaded_by_type in ('public', 'admin', 'employee')),
  uploaded_by_id uuid,
  confirmation_token_hash text not null,
  created_at timestamptz default now(),
  ready_at timestamptz,
  deleted_at timestamptz
);

create index media_assets_entity_idx on public.media_assets(workspace_id, entity_type, entity_id);
create index media_assets_pending_idx on public.media_assets(status, created_at);

alter table public.media_assets enable row level security;
grant select, insert, update, delete on table public.media_assets to service_role;
