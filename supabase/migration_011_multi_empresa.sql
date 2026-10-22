-- migration_011_multi_empresa.sql
-- Convierte Faena de una sola empresa a multi-tenant: cada empresa cliente
-- tiene sus datos y su proceso de aprobación de usuarios 100% aislados.
-- Idempotente: se puede correr más de una vez sin romperse.
--
-- ANTES DE CORRER: reemplazá el nombre de placeholder más abajo
-- ('Mi Empresa (completar nombre real)') por el nombre real de tu empresa.

begin;

-- ───────────────────────── 1. Tabla de empresas ─────────────────────────

create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

alter table companies enable row level security;

-- ───────────────────────── 2. company_id en todas las tablas ─────────────────────────
-- Se agrega NULLABLE primero, se completa con el backfill, y recién al final
-- se pone NOT NULL + default (ver paso 4). Así no se rompe si ya hay datos.

alter table contacts               add column if not exists company_id uuid references companies(id);
alter table machines               add column if not exists company_id uuid references companies(id);
alter table settings               add column if not exists company_id uuid references companies(id);
alter table jobs                   add column if not exists company_id uuid references companies(id);
alter table job_workers            add column if not exists company_id uuid references companies(id);
alter table job_expenses           add column if not exists company_id uuid references companies(id);
alter table job_payments           add column if not exists company_id uuid references companies(id);
alter table job_machines           add column if not exists company_id uuid references companies(id);
alter table job_log                add column if not exists company_id uuid references companies(id);
alter table audit_log              add column if not exists company_id uuid references companies(id);
alter table work_orders            add column if not exists company_id uuid references companies(id);
alter table maintenance_schedules  add column if not exists company_id uuid references companies(id);
alter table job_invoices           add column if not exists company_id uuid references companies(id);
alter table user_roles             add column if not exists company_id uuid references companies(id);
alter table profiles               add column if not exists company_id uuid references companies(id);

-- ───────────────────────── 3. Empresa por defecto + backfill ─────────────────────────

do $$
declare
  default_company_id uuid;
begin
  if not exists (select 1 from companies) then
    insert into companies (name, invite_code)
    values (
      'Mi Empresa (completar nombre real)',       -- <-- EDITÁ ESTO antes de correr
      upper(substr(md5(random()::text), 1, 8))     -- código de invitación random, ej. "A3F9C1D2"
    )
    returning id into default_company_id;
  else
    select id into default_company_id from companies order by created_at asc limit 1;
  end if;

  update contacts              set company_id = default_company_id where company_id is null;
  update machines              set company_id = default_company_id where company_id is null;
  update settings              set company_id = default_company_id where company_id is null;
  update jobs                  set company_id = default_company_id where company_id is null;
  update job_workers           set company_id = default_company_id where company_id is null;
  update job_expenses          set company_id = default_company_id where company_id is null;
  update job_payments          set company_id = default_company_id where company_id is null;
  update job_machines          set company_id = default_company_id where company_id is null;
  update job_log               set company_id = default_company_id where company_id is null;
  update audit_log             set company_id = default_company_id where company_id is null;
  update work_orders           set company_id = default_company_id where company_id is null;
  update maintenance_schedules set company_id = default_company_id where company_id is null;
  update job_invoices          set company_id = default_company_id where company_id is null;
  update user_roles            set company_id = default_company_id where company_id is null;
  update profiles              set company_id = default_company_id where company_id is null;
end $$;

-- ───────────────────────── 4. my_company_id() + NOT NULL + default ─────────────────────────

create or replace function my_company_id()
returns uuid as $$
  select company_id from user_roles where user_id = auth.uid();
$$ language sql security definer stable set search_path = public;

alter table contacts               alter column company_id set not null, alter column company_id set default my_company_id();
alter table machines               alter column company_id set not null, alter column company_id set default my_company_id();
alter table settings               alter column company_id set not null, alter column company_id set default my_company_id();
alter table jobs                   alter column company_id set not null, alter column company_id set default my_company_id();
alter table job_workers            alter column company_id set not null, alter column company_id set default my_company_id();
alter table job_expenses           alter column company_id set not null, alter column company_id set default my_company_id();
alter table job_payments           alter column company_id set not null, alter column company_id set default my_company_id();
alter table job_machines           alter column company_id set not null, alter column company_id set default my_company_id();
alter table job_log                alter column company_id set not null, alter column company_id set default my_company_id();
alter table audit_log              alter column company_id set not null, alter column company_id set default my_company_id();
alter table work_orders            alter column company_id set not null, alter column company_id set default my_company_id();
alter table maintenance_schedules  alter column company_id set not null, alter column company_id set default my_company_id();
alter table job_invoices           alter column company_id set not null, alter column company_id set default my_company_id();
alter table user_roles             alter column company_id set not null;  -- lo pone el trigger, nunca un default
alter table profiles               alter column company_id set not null;  -- idem

-- ───────────────────────── 5. settings: unique (key) -> unique (company_id, key) ─────────────────────────

alter table settings drop constraint if exists settings_key_key;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'settings_company_key_unique') then
    alter table settings add constraint settings_company_key_unique unique (company_id, key);
  end if;
end $$;

-- ───────────────────────── 6. handle_new_user(): invite_code -> company_id, "primer usuario" por empresa ─────────────────────────

create or replace function handle_new_user()
returns trigger as $$
declare
  invite text;
  resolved_company_id uuid;
  is_first boolean;
begin
  invite := upper(trim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));

  if invite = '' then
    raise exception 'CODIGO_INVITACION_FALTANTE';
  end if;

  select id into resolved_company_id from companies where invite_code = invite;

  if resolved_company_id is null then
    raise exception 'CODIGO_INVITACION_INVALIDO';
  end if;

  insert into profiles (id, email, first_name, last_name, company_id)
    values (
      new.id,
      new.email,
      new.raw_user_meta_data ->> 'first_name',
      new.raw_user_meta_data ->> 'last_name',
      resolved_company_id
    );

  select not exists (
    select 1 from user_roles where company_id = resolved_company_id
  ) into is_first;

  insert into user_roles (user_id, role, approved, company_id)
    values (new.id, case when is_first then 'admin' else 'tecnico' end, is_first, resolved_company_id);

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- (el trigger on_auth_user_created ya existe desde migration_006 y apunta a esta función — no hace falta recrearlo)

-- ───────────────────────── 7. RLS: companies ─────────────────────────

drop policy if exists "ver mi propia empresa" on companies;
create policy "ver mi propia empresa" on companies for select using (id = my_company_id());
-- sin políticas de insert/update/delete: las empresas se crean a mano por SQL Editor (rol postgres, bypassa RLS).

-- ───────────────────────── 8. RLS: agregar predicado de empresa a cada tabla ─────────────────────────

-- contacts
drop policy if exists "lectura aprobados" on contacts;
create policy "lectura aprobados" on contacts for select
  using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on contacts;
create policy "escritura equipo" on contacts for insert
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo update" on contacts;
create policy "escritura equipo update" on contacts for update
  using (can_write() and company_id = my_company_id())
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo delete" on contacts;
create policy "escritura equipo delete" on contacts for delete
  using (can_write() and company_id = my_company_id());

-- machines
drop policy if exists "lectura aprobados" on machines;
create policy "lectura aprobados" on machines for select
  using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on machines;
create policy "escritura equipo" on machines for insert
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo update" on machines;
create policy "escritura equipo update" on machines for update
  using (can_write() and company_id = my_company_id())
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo delete" on machines;
create policy "escritura equipo delete" on machines for delete
  using (can_write() and company_id = my_company_id());

-- jobs
drop policy if exists "lectura aprobados" on jobs;
create policy "lectura aprobados" on jobs for select
  using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on jobs;
create policy "escritura equipo" on jobs for insert
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo update" on jobs;
create policy "escritura equipo update" on jobs for update
  using (can_write() and company_id = my_company_id())
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo delete" on jobs;
create policy "escritura equipo delete" on jobs for delete
  using (can_write() and company_id = my_company_id());

-- job_workers
drop policy if exists "lectura aprobados" on job_workers;
create policy "lectura aprobados" on job_workers for select
  using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on job_workers;
create policy "escritura equipo" on job_workers for insert
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo update" on job_workers;
create policy "escritura equipo update" on job_workers for update
  using (can_write() and company_id = my_company_id())
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo delete" on job_workers;
create policy "escritura equipo delete" on job_workers for delete
  using (can_write() and company_id = my_company_id());

-- job_expenses
drop policy if exists "lectura aprobados" on job_expenses;
create policy "lectura aprobados" on job_expenses for select
  using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on job_expenses;
create policy "escritura equipo" on job_expenses for insert
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo update" on job_expenses;
create policy "escritura equipo update" on job_expenses for update
  using (can_write() and company_id = my_company_id())
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo delete" on job_expenses;
create policy "escritura equipo delete" on job_expenses for delete
  using (can_write() and company_id = my_company_id());

-- job_payments
drop policy if exists "lectura aprobados" on job_payments;
create policy "lectura aprobados" on job_payments for select
  using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on job_payments;
create policy "escritura equipo" on job_payments for insert
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo update" on job_payments;
create policy "escritura equipo update" on job_payments for update
  using (can_write() and company_id = my_company_id())
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo delete" on job_payments;
create policy "escritura equipo delete" on job_payments for delete
  using (can_write() and company_id = my_company_id());

-- job_machines
drop policy if exists "lectura aprobados" on job_machines;
create policy "lectura aprobados" on job_machines for select
  using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on job_machines;
create policy "escritura equipo" on job_machines for insert
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo update" on job_machines;
create policy "escritura equipo update" on job_machines for update
  using (can_write() and company_id = my_company_id())
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo delete" on job_machines;
create policy "escritura equipo delete" on job_machines for delete
  using (can_write() and company_id = my_company_id());

-- job_log
drop policy if exists "lectura aprobados" on job_log;
create policy "lectura aprobados" on job_log for select
  using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on job_log;
create policy "escritura equipo" on job_log for insert
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo update" on job_log;
create policy "escritura equipo update" on job_log for update
  using (can_write() and company_id = my_company_id())
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo delete" on job_log;
create policy "escritura equipo delete" on job_log for delete
  using (can_write() and company_id = my_company_id());

-- work_orders
drop policy if exists "lectura aprobados" on work_orders;
create policy "lectura aprobados" on work_orders for select
  using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on work_orders;
create policy "escritura equipo" on work_orders for insert
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo update" on work_orders;
create policy "escritura equipo update" on work_orders for update
  using (can_write() and company_id = my_company_id())
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo delete" on work_orders;
create policy "escritura equipo delete" on work_orders for delete
  using (can_write() and company_id = my_company_id());

-- maintenance_schedules
drop policy if exists "lectura aprobados" on maintenance_schedules;
create policy "lectura aprobados" on maintenance_schedules for select
  using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on maintenance_schedules;
create policy "escritura equipo" on maintenance_schedules for insert
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo update" on maintenance_schedules;
create policy "escritura equipo update" on maintenance_schedules for update
  using (can_write() and company_id = my_company_id())
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo delete" on maintenance_schedules;
create policy "escritura equipo delete" on maintenance_schedules for delete
  using (can_write() and company_id = my_company_id());

-- job_invoices
drop policy if exists "lectura aprobados" on job_invoices;
create policy "lectura aprobados" on job_invoices for select
  using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on job_invoices;
create policy "escritura equipo" on job_invoices for insert
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo update" on job_invoices;
create policy "escritura equipo update" on job_invoices for update
  using (can_write() and company_id = my_company_id())
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo delete" on job_invoices;
create policy "escritura equipo delete" on job_invoices for delete
  using (can_write() and company_id = my_company_id());

-- settings (sin delete)
drop policy if exists "lectura aprobados" on settings;
create policy "lectura aprobados" on settings for select
  using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on settings;
create policy "escritura equipo" on settings for insert
  with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo update" on settings;
create policy "escritura equipo update" on settings for update
  using (can_write() and company_id = my_company_id())
  with check (can_write() and company_id = my_company_id());

-- audit_log (solo select + insert)
drop policy if exists "lectura aprobados" on audit_log;
create policy "lectura aprobados" on audit_log for select
  using (is_approved() and company_id = my_company_id());
drop policy if exists "cualquier aprobado audita" on audit_log;
create policy "cualquier aprobado audita" on audit_log for insert
  with check (is_approved() and company_id = my_company_id());

-- user_roles (solo select + update, sin insert — lo crea el trigger)
drop policy if exists "ver roles del equipo" on user_roles;
create policy "ver roles del equipo" on user_roles for select
  using (is_approved() and company_id = my_company_id());
drop policy if exists "admin aprueba y asigna roles" on user_roles;
create policy "admin aprueba y asigna roles" on user_roles for update
  using (is_admin() and company_id = my_company_id())
  with check (is_admin() and company_id = my_company_id());

-- profiles (select + update propio, sin tocar el using de "id = auth.uid()")
drop policy if exists "ver perfiles del equipo" on profiles;
create policy "ver perfiles del equipo" on profiles for select
  using (is_approved() and company_id = my_company_id());
drop policy if exists "cada uno edita su propio perfil" on profiles;
create policy "cada uno edita su propio perfil" on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and company_id = my_company_id());

commit;

select name, invite_code from companies;  -- anotá esto: es lo que le vas a dar a tus empleados para que se registren
