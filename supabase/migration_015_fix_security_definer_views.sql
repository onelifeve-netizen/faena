-- Fix: las vistas machine_depreciation y job_wip corrían con los permisos de
-- quien las creó (SECURITY DEFINER implícito), ignorando el RLS de quien
-- consulta. Esto permitía, en teoría, ver datos de depreciación y de WIP de
-- otras empresas. security_invoker hace que la vista respete el RLS del
-- usuario que consulta, como cualquier tabla normal.

alter view public.machine_depreciation set (security_invoker = true);
alter view public.job_wip set (security_invoker = true);

NOTIFY pgrst, 'reload schema';
