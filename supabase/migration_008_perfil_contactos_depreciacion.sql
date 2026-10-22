-- Perfil de usuario (nombre/apellido/foto), contactos más completos
-- (celular/ubicación), y depreciación lineal + costo total de mantenimiento
-- por máquina. Correr después de migration_006_faena.sql.

-- ───────────────────────── Perfil de usuario ─────────────────────────

alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;
alter table profiles add column if not exists avatar_url text;

-- El registro (/registro) manda first_name/last_name como metadata del
-- signUp; el trigger los toma de ahí si vienen, para no pedirle a Supabase
-- Auth que los guarde en ningún otro lado.
create or replace function handle_new_user()
returns trigger as $$
declare
  is_first boolean;
begin
  insert into profiles (id, email, first_name, last_name)
    values (
      new.id,
      new.email,
      new.raw_user_meta_data ->> 'first_name',
      new.raw_user_meta_data ->> 'last_name'
    );
  select not exists (select 1 from user_roles) into is_first;
  insert into user_roles (user_id, role, approved)
    values (new.id, case when is_first then 'admin' else 'tecnico' end, is_first);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Bucket público de avatares: cada usuario solo puede subir/reemplazar el
-- suyo (un archivo nombrado "<user_id>.jpg" o similar), pero cualquiera
-- aprobado puede verlos (son fotos de perfil del equipo, no datos sensibles).
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists "avatares visibles para todos" on storage.objects;
create policy "avatares visibles para todos"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "cada uno sube su propio avatar" on storage.objects;
create policy "cada uno sube su propio avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "cada uno actualiza su propio avatar" on storage.objects;
create policy "cada uno actualiza su propio avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────────────────────── Contactos: celular y ubicación ─────────────────────────

alter table contacts add column if not exists location text;
-- "phone" ya existía — en el formulario ahora se etiqueta como "Celular".
-- "email" ya era opcional en la base (nullable); solo faltaba decirlo en la UI.

-- ───────────────────────── Maquinaria: depreciación lineal ─────────────────────────

alter table machines add column if not exists purchase_price numeric;
alter table machines add column if not exists purchase_date date;
alter table machines add column if not exists useful_life_years integer;

-- Vista con el cálculo de depreciación lineal y el costo total de
-- mantenimiento acumulado (para comparar contra el valor del equipo y
-- decidir si conviene seguir reparando o reemplazar).
create or replace view machine_depreciation as
select
  m.id as machine_id,
  m.purchase_price,
  m.purchase_date,
  m.useful_life_years,
  case when m.purchase_price is not null and m.useful_life_years > 0
    then round(m.purchase_price / m.useful_life_years, 2)
    else null
  end as annual_depreciation,
  case when m.purchase_date is not null
    then greatest(0, extract(year from age(current_date, m.purchase_date))
                     + extract(month from age(current_date, m.purchase_date)) / 12.0)
    else null
  end as years_elapsed,
  case when m.purchase_price is not null and m.useful_life_years > 0 and m.purchase_date is not null
    then greatest(0, m.purchase_price - (m.purchase_price / m.useful_life_years) *
         least(m.useful_life_years, extract(year from age(current_date, m.purchase_date))
                                     + extract(month from age(current_date, m.purchase_date)) / 12.0))
    else null
  end as book_value,
  coalesce(wo.total_cost, 0) as maintenance_cost_total
from machines m
left join (
  select machine_id, sum(cost) as total_cost from work_orders where cost is not null group by machine_id
) wo on wo.machine_id = m.id;
