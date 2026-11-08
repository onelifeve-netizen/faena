-- Campo "Tipo" de inventario: a diferencia de "category" (texto libre, por
-- rubro del cliente), item_type es una clasificación fija y universal que
-- alimenta un glosario en la UI. Nullable + default 'equipo' para no romper
-- los artículos ya cargados.
alter table machines add column if not exists item_type text not null default 'equipo'
  check (item_type in ('equipo', 'accesorio', 'repuesto', 'herramienta', 'consumible'));

NOTIFY pgrst, 'reload schema';
