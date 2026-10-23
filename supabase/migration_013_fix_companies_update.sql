-- migration_013_fix_companies_update.sql
-- Faltaba la política RLS de UPDATE en `companies` — sin esto, nadie puede
-- guardar el rubro/industria desde /ajustes (la tabla solo tenía SELECT).
-- Solo admin puede editar los datos de su propia empresa.

drop policy if exists "admin edita su empresa" on companies;
create policy "admin edita su empresa" on companies for update
  using (id = my_company_id() and is_admin())
  with check (id = my_company_id() and is_admin());

NOTIFY pgrst, 'reload schema';
