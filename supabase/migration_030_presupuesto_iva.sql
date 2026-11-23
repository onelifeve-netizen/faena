-- Permite marcar si un ítem de presupuesto lleva impuesto/IVA y a qué tasa,
-- para que el presupuesto itemizado de una obra quede bien desglosado.
alter table job_budget_items add column if not exists applies_tax boolean not null default false;
alter table job_budget_items add column if not exists tax_rate numeric not null default 0;

NOTIFY pgrst, 'reload schema';
