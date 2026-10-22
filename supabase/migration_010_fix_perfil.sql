-- Arregla un bug real: la tabla profiles solo tenía política de lectura,
-- nunca se agregó la de escritura — por eso guardar el perfil (nombre,
-- apellido, foto) estaba fallando en silencio para todo el mundo.

drop policy if exists "cada uno edita su propio perfil" on profiles;
create policy "cada uno edita su propio perfil"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
