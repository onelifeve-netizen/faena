-- Pasa el modelo de inventario de "1 fila = 1 bien serializado" a soportar
-- también "1 fila = 1 ítem de stock con cantidad", sin romper lo serializado
-- que ya existe (useful_life_years, serial_photo_url, depreciación, etc.).
alter table machines add column if not exists quantity integer not null default 1;
alter table machines add column if not exists item_code text;
alter table machines add column if not exists temporary_location text;
alter table machines add column if not exists inventory_date date;
alter table machines add column if not exists source text not null default 'manual' check (source in ('import', 'manual'));

-- item_code es único por empresa, pero puede ser null (lo cargado a mano no tiene).
create unique index if not exists machines_item_code_unique on machines(company_id, item_code) where item_code is not null;

-- Registro de auditoría de cada importación desde Excel, para poder ver
-- qué se cargó, cuándo, y por quién.
create table if not exists import_logs (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null default my_company_id(),
  created_at timestamptz not null default now(),
  file_name text not null,
  uploaded_by_email text,
  mode text not null default 'update' check (mode in ('update', 'replace')),
  created_count integer not null default 0,
  updated_count integer not null default 0,
  unchanged_count integer not null default 0,
  ignored_count integer not null default 0,
  not_found_count integer not null default 0,
  total_value numeric,
  total_value_currency text
);

alter table import_logs enable row level security;
drop policy if exists "lectura aprobados" on import_logs;
create policy "lectura aprobados" on import_logs for select using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on import_logs;
create policy "escritura equipo" on import_logs for insert with check (can_write() and company_id = my_company_id());

NOTIFY pgrst, 'reload schema';
