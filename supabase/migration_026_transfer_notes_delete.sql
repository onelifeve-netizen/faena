-- Permite anular una guía de traslado mal hecha (ej. destino tipeado mal).
-- Antes solo se podía crear/leer, nunca borrar.
drop policy if exists "borrado equipo" on transfer_notes;
create policy "borrado equipo" on transfer_notes for delete using (can_write() and company_id = my_company_id());

NOTIFY pgrst, 'reload schema';
