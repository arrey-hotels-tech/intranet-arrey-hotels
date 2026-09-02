create table public.internal_tasks (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces(id) not null,
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

create table public.internal_task_participants (
  id bigint generated always as identity primary key,
  task_id bigint references public.internal_tasks(id) on delete cascade not null,
  employee_id uuid references public.employees(id) not null,
  participation_role text not null check (participation_role in ('executor', 'acompanhante')),
  invitation_status text not null default 'pendente' check (invitation_status in ('pendente', 'aceito')),
  created_at timestamptz default now(),
  unique (task_id, employee_id, participation_role)
);

create index internal_tasks_workspace_idx on public.internal_tasks(workspace_id);
create index internal_tasks_creator_idx on public.internal_tasks(creator_type, creator_id);
create index internal_tasks_assignee_idx on public.internal_tasks(assignee_type, assignee_id);
create index internal_task_participants_employee_idx on public.internal_task_participants(employee_id);

alter table public.internal_tasks enable row level security;
alter table public.internal_task_participants enable row level security;

grant select, insert, update, delete on table
  public.internal_tasks,
  public.internal_task_participants
to service_role;

grant usage, select on sequence
  public.internal_tasks_id_seq,
  public.internal_task_participants_id_seq
to service_role;
