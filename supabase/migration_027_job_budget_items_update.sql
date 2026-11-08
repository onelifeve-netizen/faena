-- Permite editar un ítem de presupuesto en vez de tener que borrarlo y
-- recrearlo cuando se corrige una cantidad o un precio.
drop policy if exists "escritura equipo update" on job_budget_items;
create policy "escritura equipo update" on job_budget_items for update using (can_write() and company_id = my_company_id());

NOTIFY pgrst, 'reload schema';
