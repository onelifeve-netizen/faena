-- Pegar este script completo en Supabase > SQL Editor > New query > Run

create extension if not exists "uuid-ossp";

create table contacts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  role text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table machines (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text,
  serial text,
  status text not null default 'disponible' check (status in ('disponible', 'en_obra', 'mantenimiento')),
  notes text,
  created_at timestamptz not null default now()
);

create table settings (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,
  value text not null
);

insert into settings (key, value) values ('reference_currency', 'USD');

create table jobs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  client text,
  status text not null default 'planificada' check (status in ('planificada', 'en_curso', 'terminada')),
  start_date date,
  end_date date,
  budget numeric not null default 0,
  budget_currency text not null default 'ARS',
  budget_fx_rate numeric not null default 1,
  category text,
  location text,
  contact_id uuid references contacts(id) on delete set null,
  contact_name text,
  contact_phone text,
  contact_email text,
  responsible_name text,
  created_at timestamptz not null default now()
);

create table job_workers (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  name text not null,
  role text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table job_expenses (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id) on delete cascade,
  description text not null,
  amount numeric not null default 0,
  currency text not null default 'ARS',
  fx_rate numeric not null default 1,
  created_at timestamptz not null default now()
);

create table job_payments (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id) on delete cascade,
  amount numeric not null default 0,
  currency text not null default 'ARS',
  fx_rate numeric not null default 1,
  paid_at date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create table job_machines (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id) on delete cascade,
  machine_id uuid not null references machines(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  returned_at timestamptz
);

create table job_log (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  detail text,
  user_email text,
  created_at timestamptz not null default now()
);

-- Acceso: cualquier usuario con cuenta creada en la app (login) puede leer y
-- escribir todos los datos del equipo. No hay aislamiento por usuario porque
-- la idea es que todo el equipo comparta la misma información.
alter table machines enable row level security;
alter table jobs enable row level security;
alter table job_expenses enable row level security;
alter table job_machines enable row level security;
alter table job_log enable row level security;
alter table job_workers enable row level security;
alter table contacts enable row level security;
alter table job_payments enable row level security;
alter table settings enable row level security;
alter table audit_log enable row level security;

create policy "usuarios logueados" on machines for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "usuarios logueados" on jobs for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "usuarios logueados" on job_expenses for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "usuarios logueados" on job_machines for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "usuarios logueados" on job_log for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "usuarios logueados" on job_workers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "usuarios logueados" on contacts for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "usuarios logueados" on job_payments for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "usuarios logueados" on settings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "usuarios logueados" on audit_log for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Los recordatorios por mail (cron job) leen la base con la service_role key,
-- que ignora RLS, así que no necesitan una política aparte.

-- IMPORTANTE: en Supabase > Authentication > Providers, dejá activado "Email"
-- y desactivá "Confirm email" si querés que el equipo pueda entrar apenas se
-- registra, sin tener que confirmar el correo primero (más simple para uso interno).
