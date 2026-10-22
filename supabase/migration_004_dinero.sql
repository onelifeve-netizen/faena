-- Ejecutar SOLO si ya habías corrido schema.sql antes de esta actualización.

create table if not exists settings (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,
  value text not null
);
insert into settings (key, value) values ('reference_currency', 'USD')
  on conflict (key) do nothing;

alter table jobs add column if not exists budget_currency text not null default 'ARS';
alter table jobs add column if not exists budget_fx_rate numeric not null default 1;
alter table jobs add column if not exists category text;

alter table job_expenses add column if not exists currency text not null default 'ARS';
alter table job_expenses add column if not exists fx_rate numeric not null default 1;

create table if not exists job_payments (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id) on delete cascade,
  amount numeric not null default 0,
  currency text not null default 'ARS',
  fx_rate numeric not null default 1,
  paid_at date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

alter table job_payments enable row level security;
alter table settings enable row level security;

drop policy if exists "usuarios logueados" on job_payments;
create policy "usuarios logueados" on job_payments for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "usuarios logueados" on settings;
create policy "usuarios logueados" on settings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
