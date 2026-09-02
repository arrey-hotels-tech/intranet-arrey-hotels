-- ============================================================
-- Intranet Arrey Hotels — schema Fase 1
-- Rodar isso no SQL Editor do Supabase (projeto novo, vazio)
-- ============================================================

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table areas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) not null,
  name text not null,
  active boolean default true,
  created_at timestamptz default now(),
  unique (workspace_id, name)
);

-- Gestores e diretoria (Fase 1) e colaboradores (Fase 2) — login por CPF + Telegram
create table employees (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) not null,
  area_id uuid references areas(id),
  name text not null,
  cpf text not null unique,
  birth_date date not null,
  phone text,
  email text,
  role text not null check (role in ('gestor', 'diretoria', 'colaborador')),
  source text not null default 'manual' check (source in ('manual', 'sheet_sync')),
  telegram_chat_id text,
  telegram_link_token text,
  telegram_link_token_expires_at timestamptz,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table access_codes (
  id bigint generated always as identity primary key,
  employee_id uuid references employees(id) not null,
  code text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz default now()
);

create table demands (
  id bigint generated always as identity primary key,
  workspace_id uuid references workspaces(id) not null,
  area_id uuid references areas(id) not null,
  requester_info text not null,
  title text not null,
  description text not null,
  priority text not null check (priority in ('baixa', 'media', 'alta')),
  status text not null default 'novo' check (status in ('novo', 'em_andamento', 'aguardando', 'concluido', 'arquivado')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table demand_status_history (
  id bigint generated always as identity primary key,
  demand_id bigint references demands(id) not null,
  old_status text,
  new_status text not null,
  changed_at timestamptz default now()
);

-- Tarefas internas do Kanban. Admin pertence ao Supabase Auth e os demais
-- atores pertencem a employees, por isso criador/responsável possuem tipo + id.
create table internal_tasks (
  id bigint generated always as identity primary key,
  workspace_id uuid references workspaces(id) not null,
  creator_type text not null check (creator_type in ('admin', 'employee')),
  creator_id uuid not null,
  assignee_type text not null check (assignee_type in ('admin', 'employee')),
  assignee_id uuid not null,
  title text not null,
  description text,
  priority text not null default 'media' check (priority in ('baixa', 'media', 'alta')),
  status text not null default 'novo' check (status in ('novo', 'em_andamento', 'aguardando', 'concluido', 'arquivado')),
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table internal_task_participants (
  id bigint generated always as identity primary key,
  task_id bigint references internal_tasks(id) on delete cascade not null,
  employee_id uuid references employees(id) not null,
  participation_role text not null check (participation_role in ('executor', 'acompanhante')),
  invitation_status text not null default 'pendente' check (invitation_status in ('pendente', 'aceito')),
  created_at timestamptz default now(),
  unique (task_id, employee_id, participation_role)
);

-- ============================================================
-- RLS: só o service_role (usado pelo servidor da aplicação) mexe
-- nessas tabelas. A anon key não tem acesso direto a nada aqui —
-- tudo passa pelas server actions do Next.js.
-- ============================================================
alter table workspaces enable row level security;
alter table areas enable row level security;
alter table employees enable row level security;
alter table access_codes enable row level security;
alter table demands enable row level security;
alter table demand_status_history enable row level security;
alter table internal_tasks enable row level security;
alter table internal_task_participants enable row level security;
-- Nenhuma policy criada de propósito: sem policy = bloqueado pra anon/authenticated,
-- e o service_role sempre ignora RLS (é assim que o backend consegue ler/escrever).

-- ============================================================
-- Seed: workspace + 11 hotéis + Arrey Administração
-- ============================================================
insert into workspaces (name) values ('Arrey Hotels') returning id;
-- ⚠️ copie o id retornado acima e cole no lugar de :workspace_id abaixo
-- (o SQL Editor do Supabase não guarda variáveis entre statements)

insert into areas (workspace_id, name, active) values
  (:workspace_id, 'Picos', true),
  (:workspace_id, 'Piracuruca', true),
  (:workspace_id, 'Express', true),
  (:workspace_id, 'Gran', true),
  (:workspace_id, 'Fórmula (Matriz)', true),
  (:workspace_id, 'Uruçuí', true),
  (:workspace_id, 'Executive', true),
  (:workspace_id, 'Rio Poty', true),
  (:workspace_id, 'Boutique', true),
  (:workspace_id, 'Beach', true),
  (:workspace_id, 'Itaueira', true),
  (:workspace_id, 'Arrey Administração', true);

-- ============================================================
-- Seed dos gestores — PENDENTE: preencher CPF e data de nascimento
-- de cada um antes de rodar (ver PRD, seção 9.3)
-- ============================================================
-- insert into employees (workspace_id, area_id, name, cpf, birth_date, phone, role, source) values
--   (:workspace_id, (select id from areas where workspace_id = :workspace_id and name = 'Executive'), 'Edilson Visgueira', '00000000000', '1980-01-01', '+55 86 98149-0996', 'gestor', 'manual'),
--   (:workspace_id, (select id from areas where workspace_id = :workspace_id and name = 'Fórmula (Matriz)'), 'Angerson Macedo', '00000000000', '1980-01-01', '+55 86 98125-0921', 'gestor', 'manual'),
--   (:workspace_id, (select id from areas where workspace_id = :workspace_id and name = 'Express'), 'David Araújo', '00000000000', '1980-01-01', '+55 86 99556-6232', 'gestor', 'manual'),
--   (:workspace_id, (select id from areas where workspace_id = :workspace_id and name = 'Gran'), 'Virginia Bacelar', '00000000000', '1980-01-01', '+55 86 99985-2394', 'gestor', 'manual'),
--   (:workspace_id, (select id from areas where workspace_id = :workspace_id and name = 'Uruçuí'), 'Silvestre Freitas', '00000000000', '1980-01-01', '+55 89 98809-1010', 'gestor', 'manual'),
--   (:workspace_id, (select id from areas where workspace_id = :workspace_id and name = 'Itaueira'), 'Aurileny Ribeiro', '00000000000', '1980-01-01', '+55 89 98151-5044', 'gestor', 'manual'),
--   (:workspace_id, (select id from areas where workspace_id = :workspace_id and name = 'Picos'), 'Renildo Silva', '00000000000', '1980-01-01', '+55 86 99412-6850', 'gestor', 'manual'),
--   (:workspace_id, (select id from areas where workspace_id = :workspace_id and name = 'Rio Poty'), 'Josy', '00000000000', '1980-01-01', '+55 86 99575-2790', 'gestor', 'manual'),
--   (:workspace_id, (select id from areas where workspace_id = :workspace_id and name = 'Beach'), 'Paulo Airton', '00000000000', '1980-01-01', '+55 86 99436-6147', 'gestor', 'manual'),
--   (:workspace_id, (select id from areas where workspace_id = :workspace_id and name = 'Boutique'), 'Lizz', '00000000000', '1980-01-01', '+55 86 99843-4760', 'gestor', 'manual'),
--   (:workspace_id, (select id from areas where workspace_id = :workspace_id and name = 'Piracuruca'), 'Ana Oliveira', '00000000000', '1980-01-01', '+55 86 99971-2812', 'gestor', 'manual');
