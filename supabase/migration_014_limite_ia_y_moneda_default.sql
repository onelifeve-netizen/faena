-- migration_014_limite_ia_y_moneda_default.sql
-- 1) Límite de uso diario de IA por empresa (evita sorpresas de costo).
-- 2) Moneda de referencia por defecto para empresas nuevas (hoy quedaba en
--    USD "en silencio" hasta que alguien entrara a Ajustes a configurarla).
-- Idempotente.

-- ───────────────────────── 1. Control de uso de IA ─────────────────────────

create table if not exists ai_usage (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) default my_company_id(),
  user_id uuid not null default auth.uid(),
  function_name text not null,
  created_at timestamptz not null default now()
);

alter table ai_usage enable row level security;

drop policy if exists "ver uso de ia de mi empresa" on ai_usage;
create policy "ver uso de ia de mi empresa" on ai_usage for select
  using (is_approved() and company_id = my_company_id());

drop policy if exists "registrar uso de ia" on ai_usage;
create policy "registrar uso de ia" on ai_usage for insert
  with check (is_approved() and company_id = my_company_id());

-- ───────────────────────── 2. Moneda de referencia por defecto ─────────────────────────

-- Backfill: empresas ya existentes que no tengan reference_currency configurada.
insert into settings (key, value, company_id)
select 'reference_currency', 'USD', c.id
from companies c
where not exists (
  select 1 from settings s where s.company_id = c.id and s.key = 'reference_currency'
);

-- A futuro: el primer usuario de cada empresa nueva ya arranca con USD seteado.
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

  if is_first then
    insert into settings (key, value, company_id)
    values ('reference_currency', 'USD', resolved_company_id)
    on conflict (company_id, key) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

NOTIFY pgrst, 'reload schema';
