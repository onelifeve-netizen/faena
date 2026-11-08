-- El campo item_type arrancó como lista cerrada (migration_017), pero el
-- usuario necesita poder agregar tipos propios además de los 5 por defecto
-- (Equipo/Accesorio/Repuesto/Herramienta/Consumible) — se saca el check
-- constraint para que sea texto libre, igual que category. La UI sigue
-- ofreciendo los 5 por defecto + los que ya se hayan creado, como sugerencias.
alter table machines drop constraint if exists machines_item_type_check;

NOTIFY pgrst, 'reload schema';
