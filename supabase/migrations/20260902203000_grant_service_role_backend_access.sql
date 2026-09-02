-- O backend usa exclusivamente service_role; anon/authenticated continuam
-- bloqueados pelas políticas RLS definidas no schema.
grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.workspaces,
  public.areas,
  public.employees,
  public.access_codes,
  public.demands,
  public.demand_status_history
to service_role;

grant usage, select on all sequences in schema public to service_role;
