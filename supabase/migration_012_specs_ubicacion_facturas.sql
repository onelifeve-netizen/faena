-- migration_012_specs_ubicacion_facturas.sql
-- Ficha técnica genérica por equipo, ubicación de inventario, rubro de la
-- empresa, y soporte para lector de facturas (columna + bucket de Storage).
-- Idempotente: se puede correr más de una vez sin romperse.

-- ───────────────────────── 1. Rubro de la empresa (solo informativo) ─────────────────────────

alter table companies add column if not exists industry text;

-- ───────────────────────── 2. Ubicación de cada equipo ─────────────────────────

alter table machines add column if not exists location text;

-- ───────────────────────── 3. Ficha técnica (specs libres por equipo) ─────────────────────────

create table if not exists machine_specs (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) default my_company_id(),
  machine_id uuid not null references machines(id) on delete cascade,
  label text not null,
  value text not null,
  created_at timestamptz not null default now()
);

alter table machine_specs enable row level security;

drop policy if exists "lectura aprobados" on machine_specs;
create policy "lectura aprobados" on machine_specs for select
  using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on machine_specs;
create policy "escritura equipo" on machine_specs for insert
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo update" on machine_specs;
create policy "escritura equipo update" on machine_specs for update
  using (can_write() and company_id = my_company_id())
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo delete" on machine_specs;
create policy "escritura equipo delete" on machine_specs for delete
  using (can_write() and company_id = my_company_id());

-- ───────────────────────── 4. Foto de factura en los gastos de obra ─────────────────────────

alter table job_expenses add column if not exists invoice_photo_url text;

-- ───────────────────────── 5. Bucket de Storage para facturas (privado, por empresa) ─────────────────────────

insert into storage.buckets (id, name, public)
values ('facturas', 'facturas', false)
on conflict (id) do nothing;

drop policy if exists "ver facturas de mi empresa" on storage.objects;
create policy "ver facturas de mi empresa" on storage.objects for select
  using (bucket_id = 'facturas' and is_approved() and (storage.foldername(name))[1] = my_company_id()::text);

drop policy if exists "subir facturas de mi empresa" on storage.objects;
create policy "subir facturas de mi empresa" on storage.objects for insert
  with check (bucket_id = 'facturas' and can_write() and (storage.foldername(name))[1] = my_company_id()::text);

drop policy if exists "actualizar facturas de mi empresa" on storage.objects;
create policy "actualizar facturas de mi empresa" on storage.objects for update
  using (bucket_id = 'facturas' and can_write() and (storage.foldername(name))[1] = my_company_id()::text);

NOTIFY pgrst, 'reload schema';
