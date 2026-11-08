-- Foto del N° de serie: muchos seriales son ilegibles a mano o están en
-- chapas gastadas — se puede adjuntar una foto en vez de (o además de)
-- tipear el serial. Reusa el mismo bucket privado "inventario-fotos".
alter table machines add column if not exists serial_photo_url text;

NOTIFY pgrst, 'reload schema';
