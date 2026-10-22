-- Ejecutar SOLO si ya habías corrido schema.sql antes de esta actualización.

create table if not exists audit_log (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  detail text,
  user_email text,
  created_at timestamptz not null default now()
);

alter table audit_log enable row level security;

drop policy if exists "usuarios logueados" on audit_log;
create policy "usuarios logueados" on audit_log for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
