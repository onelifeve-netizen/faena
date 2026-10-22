-- Faena — ampliación GMAO/CMMS + roles por trabajador + WIP financiero.
-- Pegar este script completo en Supabase > SQL Editor > New query > Run,
-- DESPUÉS de haber corrido schema.sql (o las migraciones anteriores si ya tenías datos).
-- Este script se puede correr más de una vez sin romperse (es idempotente):
-- si algo ya existe de un intento anterior, lo borra y lo vuelve a crear.

-- ───────────────────────── Roles y aprobación de usuarios ─────────────────────────

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'tecnico' check (role in ('admin', 'tecnico', 'lectura')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Al crear una cuenta, se genera su perfil y su fila de rol automáticamente.
-- El primer usuario que se registra en una base vacía queda admin y aprobado
-- de entrada (así alguien puede entrar a aprobar al resto); todos los
-- siguientes quedan "approved = false" hasta que un admin los apruebe desde /usuarios.
create or replace function handle_new_user()
returns trigger as $$
declare
  is_first boolean;
begin
  insert into profiles (id, email) values (new.id, new.email);
  select not exists (select 1 from user_roles) into is_first;
  insert into user_roles (user_id, role, approved)
    values (new.id, case when is_first then 'admin' else 'tecnico' end, is_first);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function is_approved()
returns boolean as $$
  select coalesce((select approved from user_roles where user_id = auth.uid()), false);
$$ language sql security definer stable set search_path = public;

create or replace function is_admin()
returns boolean as $$
  select coalesce((select approved and role = 'admin' from user_roles where user_id = auth.uid()), false);
$$ language sql security definer stable set search_path = public;

create or replace function can_write()
returns boolean as $$
  select coalesce((select approved and role in ('admin', 'tecnico') from user_roles where user_id = auth.uid()), false);
$$ language sql security definer stable set search_path = public;

alter table profiles enable row level security;
alter table user_roles enable row level security;

drop policy if exists "ver perfiles del equipo" on profiles;
create policy "ver perfiles del equipo" on profiles for select using (is_approved());

drop policy if exists "ver roles del equipo" on user_roles;
create policy "ver roles del equipo" on user_roles for select using (is_approved());

drop policy if exists "admin aprueba y asigna roles" on user_roles;
create policy "admin aprueba y asigna roles" on user_roles for update using (is_admin()) with check (is_admin());

-- ───────────────────────── Reemplazo de las políticas viejas ─────────────────────────
-- Antes: cualquier autenticado podía todo. Ahora: hace falta estar aprobado
-- para leer, y tener rol admin/tecnico para escribir en las tablas que no son
-- puramente financieras (job_expenses, job_payments, job_invoices también
-- requieren rol de escritura explícitamente, por si en el futuro se agrega un
-- rol "lectura financiera" aparte).

drop policy if exists "usuarios logueados" on machines;
drop policy if exists "usuarios logueados" on jobs;
drop policy if exists "usuarios logueados" on job_expenses;
drop policy if exists "usuarios logueados" on job_machines;
drop policy if exists "usuarios logueados" on job_log;
drop policy if exists "usuarios logueados" on job_workers;
drop policy if exists "usuarios logueados" on contacts;
drop policy if exists "usuarios logueados" on job_payments;
drop policy if exists "usuarios logueados" on settings;
drop policy if exists "usuarios logueados" on audit_log;

drop policy if exists "lectura aprobados" on machines;
create policy "lectura aprobados" on machines for select using (is_approved());
drop policy if exists "escritura equipo" on machines;
create policy "escritura equipo" on machines for insert with check (can_write());
drop policy if exists "escritura equipo update" on machines;
create policy "escritura equipo update" on machines for update using (can_write());
drop policy if exists "escritura equipo delete" on machines;
create policy "escritura equipo delete" on machines for delete using (can_write());

drop policy if exists "lectura aprobados" on jobs;
create policy "lectura aprobados" on jobs for select using (is_approved());
drop policy if exists "escritura equipo" on jobs;
create policy "escritura equipo" on jobs for insert with check (can_write());
drop policy if exists "escritura equipo update" on jobs;
create policy "escritura equipo update" on jobs for update using (can_write());
drop policy if exists "escritura equipo delete" on jobs;
create policy "escritura equipo delete" on jobs for delete using (can_write());

drop policy if exists "lectura aprobados" on job_expenses;
create policy "lectura aprobados" on job_expenses for select using (is_approved());
drop policy if exists "escritura equipo" on job_expenses;
create policy "escritura equipo" on job_expenses for insert with check (can_write());
drop policy if exists "escritura equipo update" on job_expenses;
create policy "escritura equipo update" on job_expenses for update using (can_write());
drop policy if exists "escritura equipo delete" on job_expenses;
create policy "escritura equipo delete" on job_expenses for delete using (can_write());

drop policy if exists "lectura aprobados" on job_machines;
create policy "lectura aprobados" on job_machines for select using (is_approved());
drop policy if exists "escritura equipo" on job_machines;
create policy "escritura equipo" on job_machines for insert with check (can_write());
drop policy if exists "escritura equipo update" on job_machines;
create policy "escritura equipo update" on job_machines for update using (can_write());
drop policy if exists "escritura equipo delete" on job_machines;
create policy "escritura equipo delete" on job_machines for delete using (can_write());

drop policy if exists "lectura aprobados" on job_log;
create policy "lectura aprobados" on job_log for select using (is_approved());
drop policy if exists "escritura equipo" on job_log;
create policy "escritura equipo" on job_log for insert with check (can_write());
drop policy if exists "escritura equipo update" on job_log;
create policy "escritura equipo update" on job_log for update using (can_write());
drop policy if exists "escritura equipo delete" on job_log;
create policy "escritura equipo delete" on job_log for delete using (can_write());

drop policy if exists "lectura aprobados" on job_workers;
create policy "lectura aprobados" on job_workers for select using (is_approved());
drop policy if exists "escritura equipo" on job_workers;
create policy "escritura equipo" on job_workers for insert with check (can_write());
drop policy if exists "escritura equipo update" on job_workers;
create policy "escritura equipo update" on job_workers for update using (can_write());
drop policy if exists "escritura equipo delete" on job_workers;
create policy "escritura equipo delete" on job_workers for delete using (can_write());

drop policy if exists "lectura aprobados" on contacts;
create policy "lectura aprobados" on contacts for select using (is_approved());
drop policy if exists "escritura equipo" on contacts;
create policy "escritura equipo" on contacts for insert with check (can_write());
drop policy if exists "escritura equipo update" on contacts;
create policy "escritura equipo update" on contacts for update using (can_write());
drop policy if exists "escritura equipo delete" on contacts;
create policy "escritura equipo delete" on contacts for delete using (can_write());

drop policy if exists "lectura aprobados" on job_payments;
create policy "lectura aprobados" on job_payments for select using (is_approved());
drop policy if exists "escritura equipo" on job_payments;
create policy "escritura equipo" on job_payments for insert with check (can_write());
drop policy if exists "escritura equipo update" on job_payments;
create policy "escritura equipo update" on job_payments for update using (can_write());
drop policy if exists "escritura equipo delete" on job_payments;
create policy "escritura equipo delete" on job_payments for delete using (can_write());

drop policy if exists "lectura aprobados" on settings;
create policy "lectura aprobados" on settings for select using (is_approved());
drop policy if exists "escritura equipo" on settings;
create policy "escritura equipo" on settings for insert with check (can_write());
drop policy if exists "escritura equipo update" on settings;
create policy "escritura equipo update" on settings for update using (can_write());

drop policy if exists "lectura aprobados" on audit_log;
create policy "lectura aprobados" on audit_log for select using (is_approved());
drop policy if exists "cualquier aprobado audita" on audit_log;
create policy "cualquier aprobado audita" on audit_log for insert with check (is_approved());

-- ───────────────────────── CMMS: órdenes de trabajo y mantenimiento preventivo ─────────────────────────

create table if not exists work_orders (
  id uuid primary key default uuid_generate_v4(),
  machine_id uuid not null references machines(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  type text not null default 'correctivo' check (type in ('correctivo', 'preventivo', 'inspeccion', 'emergencia')),
  title text not null,
  description text,
  priority text not null default 'media' check (priority in ('baja', 'media', 'alta')),
  status text not null default 'pendiente' check (status in ('pendiente', 'en_curso', 'cerrada')),
  assigned_to uuid references auth.users(id) on delete set null,
  cost numeric,
  closed_at timestamptz,
  closed_note text,
  created_at timestamptz not null default now()
);

create table if not exists maintenance_schedules (
  id uuid primary key default uuid_generate_v4(),
  machine_id uuid not null references machines(id) on delete cascade,
  name text not null,
  frequency_days integer not null check (frequency_days > 0),
  last_done_at date,
  next_due_at date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table work_orders enable row level security;
alter table maintenance_schedules enable row level security;

drop policy if exists "lectura aprobados" on work_orders;
create policy "lectura aprobados" on work_orders for select using (is_approved());
drop policy if exists "escritura equipo" on work_orders;
create policy "escritura equipo" on work_orders for insert with check (can_write());
drop policy if exists "escritura equipo update" on work_orders;
create policy "escritura equipo update" on work_orders for update using (can_write());
drop policy if exists "escritura equipo delete" on work_orders;
create policy "escritura equipo delete" on work_orders for delete using (can_write());

drop policy if exists "lectura aprobados" on maintenance_schedules;
create policy "lectura aprobados" on maintenance_schedules for select using (is_approved());
drop policy if exists "escritura equipo" on maintenance_schedules;
create policy "escritura equipo" on maintenance_schedules for insert with check (can_write());
drop policy if exists "escritura equipo update" on maintenance_schedules;
create policy "escritura equipo update" on maintenance_schedules for update using (can_write());
drop policy if exists "escritura equipo delete" on maintenance_schedules;
create policy "escritura equipo delete" on maintenance_schedules for delete using (can_write());

-- ───────────────────────── Financiero: facturación y WIP ─────────────────────────
-- job_payments ya existe y registra lo COBRADO (plata que efectivamente entró).
-- job_invoices es lo FACTURADO al cliente (puede estar facturado y no cobrado
-- todavía) — con ambos se puede calcular el WIP (ver vista job_wip más abajo).

create table if not exists job_invoices (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id) on delete cascade,
  amount numeric not null default 0,
  currency text not null default 'ARS',
  fx_rate numeric not null default 1,
  invoiced_at date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

alter table job_invoices enable row level security;
drop policy if exists "lectura aprobados" on job_invoices;
create policy "lectura aprobados" on job_invoices for select using (is_approved());
drop policy if exists "escritura equipo" on job_invoices;
create policy "escritura equipo" on job_invoices for insert with check (can_write());
drop policy if exists "escritura equipo update" on job_invoices;
create policy "escritura equipo update" on job_invoices for update using (can_write());
drop policy if exists "escritura equipo delete" on job_invoices;
create policy "escritura equipo delete" on job_invoices for delete using (can_write());

-- Vista de WIP por obra, método costo-a-costo (el más simple de explicar a una
-- PyME): % de avance = costo incurrido / presupuesto. Devengado = ese % del
-- presupuesto. Si lo facturado es mayor al devengado, hay sobre-facturación
-- (cobraste por trabajo que todavía no hiciste); si es menor, sub-facturación.
create or replace view job_wip as
select
  j.id as job_id,
  j.name as job_name,
  j.budget,
  j.budget_currency,
  coalesce(costs.total, 0) as cost_incurred,
  coalesce(invoiced.total, 0) as invoiced_amount,
  coalesce(collected.total, 0) as collected_amount,
  case when j.budget > 0
    then least(1, coalesce(costs.total, 0) / j.budget)
    else 0
  end as pct_complete,
  case when j.budget > 0
    then least(1, coalesce(costs.total, 0) / j.budget) * j.budget
    else 0
  end as earned_revenue,
  coalesce(invoiced.total, 0) - (
    case when j.budget > 0
      then least(1, coalesce(costs.total, 0) / j.budget) * j.budget
      else 0
    end
  ) as over_under_billing,
  (
    case when j.budget > 0
      then least(1, coalesce(costs.total, 0) / j.budget) * j.budget
      else 0
    end
  ) - coalesce(costs.total, 0) as estimated_result
from jobs j
left join (
  select job_id, sum(amount * fx_rate) as total from job_expenses group by job_id
) costs on costs.job_id = j.id
left join (
  select job_id, sum(amount * fx_rate) as total from job_invoices group by job_id
) invoiced on invoiced.job_id = j.id
left join (
  select job_id, sum(amount * fx_rate) as total from job_payments group by job_id
) collected on collected.job_id = j.id;
