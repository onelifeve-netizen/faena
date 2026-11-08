-- Guías de traslado: comprobante de que un equipo cambió de ubicación,
-- pensado para compartir con quien lo necesite (transportista, cliente) sin
-- que tenga cuenta en el sistema. share_token es la "llave" del link público
-- — no hay RLS pública, el acceso sin login pasa por la Edge Function
-- guia-publica, que solo expone lo necesario para ESE token puntual.
create table if not exists transfer_notes (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null default my_company_id(),
  machine_id uuid not null references machines(id) on delete cascade,
  from_location text,
  to_location text not null,
  note text,
  created_by_email text,
  share_token uuid not null default uuid_generate_v4() unique,
  created_at timestamptz not null default now()
);

alter table transfer_notes enable row level security;
drop policy if exists "lectura aprobados" on transfer_notes;
create policy "lectura aprobados" on transfer_notes for select using (is_approved() and company_id = my_company_id());
drop policy if exists "escritura equipo" on transfer_notes;
create policy "escritura equipo" on transfer_notes for insert with check (can_write() and company_id = my_company_id());

NOTIFY pgrst, 'reload schema';
