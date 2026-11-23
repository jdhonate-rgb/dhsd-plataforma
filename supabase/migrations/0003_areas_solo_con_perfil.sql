-- Solo quien tiene perfil (Propietario o usuario de un área) puede leer las áreas.
-- Así, aunque alguien se registre en Supabase Auth, sin perfil no ve nada.
drop policy areas_leer on public.areas;
create policy areas_leer on public.areas for select to authenticated
  using (private.es_propietario() or private.mi_area() is not null);
