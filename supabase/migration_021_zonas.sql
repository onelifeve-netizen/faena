-- Zonas/módulos de ubicación, editables por el usuario (reemplaza el texto
-- libre que tenía machines.location). Lista simple por empresa.
create table if not exists locations (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null default my_company_id(),
  name text not null,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

alter table locations enable row level security;
drop policy if exists "lectura aprobados" on locations;
create policy "lectura aprobados" on locations for select using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on locations;
create policy "escritura equipo" on locations for insert with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo update" on locations;
create policy "escritura equipo update" on locations for update using (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo delete" on locations;
create policy "escritura equipo delete" on locations for delete using (can_write() and company_id = my_company_id());

alter table machines add column if not exists location_id uuid references locations(id) on delete set null;

-- Migrar los valores de texto libre ya cargados a zonas, por empresa, y
-- enlazar cada máquina a la zona que le corresponde. machines.location
-- (texto) se deja intacta para no romper nada; location_id es lo nuevo que
-- usa la UI de acá en adelante.
insert into locations (company_id, name)
select distinct company_id, trim(location)
from machines
where location is not null and trim(location) <> ''
on conflict (company_id, name) do nothing;

update machines m
set location_id = l.id
from locations l
where l.company_id = m.company_id
  and l.name = trim(m.location)
  and m.location_id is null
  and m.location is not null and trim(m.location) <> '';

NOTIFY pgrst, 'reload schema';
