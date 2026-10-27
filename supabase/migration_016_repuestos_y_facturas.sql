-- Repuestos/presupuesto por obra: lista de ítems (material o mano de obra)
-- con cantidad x precio unitario, que suma automático como ayuda para armar
-- o validar el presupuesto de la obra. Separado de job_expenses (gastos
-- reales ya incurridos): esto es una calculadora, no un registro de gasto.
create table if not exists job_budget_items (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null default my_company_id(),
  job_id uuid not null references jobs(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  currency text not null default 'ARS',
  fx_rate numeric not null default 1,
  created_at timestamptz not null default now()
);

alter table job_budget_items enable row level security;
drop policy if exists "lectura aprobados" on job_budget_items;
create policy "lectura aprobados" on job_budget_items for select using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on job_budget_items;
create policy "escritura equipo" on job_budget_items for insert with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo delete" on job_budget_items;
create policy "escritura equipo delete" on job_budget_items for delete using (can_write() and company_id = my_company_id());

-- Facturas con foto/escaneo adjunto (igual que job_expenses.invoice_photo_url,
-- pero para la sección "Facturado al cliente" — hoy solo guardaba el monto).
alter table job_invoices add column if not exists invoice_photo_url text;

NOTIFY pgrst, 'reload schema';
