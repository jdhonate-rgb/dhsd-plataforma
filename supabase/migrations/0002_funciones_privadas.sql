-- Las funciones auxiliares de seguridad no deben ser llamables desde la API pública (/rest/v1/rpc).
-- Se mueven a un esquema `private` que Supabase no expone. Las políticas RLS y los triggers
-- siguen funcionando porque referencian las funciones por identificador interno.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

alter function public.es_propietario() set schema private;
alter function public.mi_area() set schema private;
alter function public.solicitudes_bitacora() set schema private;

revoke execute on function private.es_propietario() from public, anon;
revoke execute on function private.mi_area() from public, anon;
grant execute on function private.es_propietario() to authenticated;
grant execute on function private.mi_area() to authenticated;
-- La función del trigger no necesita ser ejecutable por nadie más.
revoke execute on function private.solicitudes_bitacora() from public, anon, authenticated;
