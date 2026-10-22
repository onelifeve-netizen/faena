-- Ejecutar SOLO si ya habías corrido schema.sql antes de esta actualización.
-- Si estás creando la base de datos por primera vez, no uses este archivo:
-- corré schema.sql directamente, que ya incluye todo esto.

alter table jobs add column if not exists location text;
alter table jobs add column if not exists contact_name text;
alter table jobs add column if not exists contact_phone text;
alter table jobs add column if not exists contact_email text;
alter table jobs add column if not exists responsible_name text;

create table if not exists job_workers (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id) on delete cascade,
  name text not null,
  role text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

alter table job_workers enable row level security;

drop policy if exists "usuarios logueados" on job_workers;
create policy "usuarios logueados" on job_workers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
