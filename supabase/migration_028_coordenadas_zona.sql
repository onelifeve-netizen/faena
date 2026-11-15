-- Coordenadas GPS de la ubicación fija de una zona (ej: "Almacén A"). Vive
-- en la zona, no en cada artículo — todos los artículos de esa zona
-- comparten la misma ubicación física.
alter table locations add column if not exists coordinates text;

NOTIFY pgrst, 'reload schema';
