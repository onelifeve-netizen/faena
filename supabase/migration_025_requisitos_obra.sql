-- Checklist de equipo/herramientas/repuestos necesarios para una obra
-- (sobre todo las planificadas/próximas), para poder chequear ANTES de
-- salir si el inventario disponible alcanza o falta algo.
--
-- match_text (opcional): si se completa, se compara contra category e
-- item_type de las máquinas para contar cuántas hay "disponible" y avisar
-- si falta. Si se deja vacío, queda como recordatorio sin chequeo
-- automático (ej. algo que no es un ítem de inventario serializado).
create table if not exists job_requirements (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null default my_company_id(),
  job_id uuid not null references jobs(id) on delete cascade,
  description text not null,
  quantity integer not null default 1,
  match_text text,
  created_at timestamptz not null default now()
);

alter table job_requirements enable row level security;
drop policy if exists "lectura aprobados" on job_requirements;
create policy "lectura aprobados" on job_requirements for select using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on job_requirements;
create policy "escritura equipo" on job_requirements for insert with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo delete" on job_requirements;
create policy "escritura equipo delete" on job_requirements for delete using (can_write() and company_id = my_company_id());

NOTIFY pgrst, 'reload schema';
