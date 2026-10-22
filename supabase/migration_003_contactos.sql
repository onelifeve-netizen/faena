-- Ejecutar SOLO si ya habías corrido schema.sql antes de esta actualización.
-- Si estás creando la base de datos por primera vez, no uses este archivo:
-- corré schema.sql directamente, que ya incluye todo esto.

create table if not exists contacts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  role text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

alter table jobs add column if not exists contact_id uuid references contacts(id) on delete set null;
alter table job_workers add column if not exists contact_id uuid references contacts(id) on delete set null;

alter table contacts enable row level security;

drop policy if exists "usuarios logueados" on contacts;
create policy "usuarios logueados" on contacts for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
