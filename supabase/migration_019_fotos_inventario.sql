-- Fotos por artículo de inventario. Tabla aparte (no una sola columna en
-- machines) porque un equipo puede tener varias fotos (general, chapa,
-- detalle de un daño, etc.) — mismo patrón que machine_specs.
create table if not exists machine_photos (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null default my_company_id(),
  machine_id uuid not null references machines(id) on delete cascade,
  photo_url text not null,
  created_at timestamptz not null default now()
);

alter table machine_photos enable row level security;
drop policy if exists "lectura aprobados" on machine_photos;
create policy "lectura aprobados" on machine_photos for select using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on machine_photos;
create policy "escritura equipo" on machine_photos for insert with check (can_write() and company_id = my_company_id());
drop policy if exists "escritura equipo delete" on machine_photos;
create policy "escritura equipo delete" on machine_photos for delete using (can_write() and company_id = my_company_id());

-- Bucket privado, scoped por empresa — mismo patrón que "facturas".
insert into storage.buckets (id, name, public)
values ('inventario-fotos', 'inventario-fotos', false)
on conflict (id) do nothing;

drop policy if exists "ver fotos de mi empresa" on storage.objects;
create policy "ver fotos de mi empresa" on storage.objects for select
  using (bucket_id = 'inventario-fotos' and is_approved() and (storage.foldername(name))[1] = my_company_id()::text);

drop policy if exists "subir fotos de mi empresa" on storage.objects;
create policy "subir fotos de mi empresa" on storage.objects for insert
  with check (bucket_id = 'inventario-fotos' and can_write() and (storage.foldername(name))[1] = my_company_id()::text);

drop policy if exists "borrar fotos de mi empresa" on storage.objects;
create policy "borrar fotos de mi empresa" on storage.objects for delete
  using (bucket_id = 'inventario-fotos' and can_write() and (storage.foldername(name))[1] = my_company_id()::text);

NOTIFY pgrst, 'reload schema';
