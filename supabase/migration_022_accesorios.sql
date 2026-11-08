-- Accesorios ligados a un equipo padre: un accesorio es una fila más en
-- machines (item_type='accesorio'), pero con parent_machine_id apuntando al
-- equipo al que pertenece. Así se reusa todo lo que ya existe (fotos, specs,
-- estado, zona) en vez de un modelo paralelo.
alter table machines add column if not exists parent_machine_id uuid references machines(id) on delete set null;

NOTIFY pgrst, 'reload schema';
