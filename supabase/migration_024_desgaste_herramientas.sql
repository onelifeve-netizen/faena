-- Seguimiento de desgaste/estado de herramientas, registrado por quien las
-- usa, para saber de un vistazo si hace falta reponer algo.
create table if not exists tool_condition_logs (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null default my_company_id(),
  machine_id uuid not null references machines(id) on delete cascade,
  condition text not null check (condition in ('bueno', 'regular', 'malo', 'reponer')),
  note text,
  logged_by_email text,
  created_at timestamptz not null default now()
);

alter table tool_condition_logs enable row level security;
drop policy if exists "lectura aprobados" on tool_condition_logs;
create policy "lectura aprobados" on tool_condition_logs for select using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on tool_condition_logs;
create policy "escritura equipo" on tool_condition_logs for insert with check (can_write() and company_id = my_company_id());

NOTIFY pgrst, 'reload schema';
