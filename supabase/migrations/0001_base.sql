-- DHSD Plataforma — esquema base: áreas, perfiles, solicitudes, cargas de Excel.
-- Principio: las áreas solo ENVÍAN (solicitudes y archivos) y ven lo suyo.
-- Solo el Propietario decide, cambia estados y ve todo. Nadie del área toca
-- directamente las bases de datos de la empresa.

create extension if not exists pgcrypto;

-- ---------- Tablas ----------
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[a-z0-9-]+$'),
  nombre text not null,
  activa boolean not null default true
);

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  rol text not null check (rol in ('propietario', 'area')),
  area_id uuid references public.areas(id),
  nombre text,
  constraint perfil_area_coherente check ((rol = 'area') = (area_id is not null))
);

create table public.solicitudes (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id),
  creado_por uuid not null default auth.uid() references auth.users(id),
  titulo text not null check (char_length(titulo) between 5 and 160),
  proceso_actual text not null,
  problema text not null,
  resultados_esperados text not null,
  indicadores text,
  alertas text,
  usuarios_roles text,
  sensibilidad text not null default 'interna'
    check (sensibilidad in ('ninguna', 'interna', 'personal', 'financiera', 'clinica')),
  volumen_aprox text,
  estado text not null default 'recibida'
    check (estado in ('recibida', 'en_analisis', 'pendiente_decision', 'aprobada', 'en_ejecucion', 'cerrada', 'rechazada')),
  prioridad text check (prioridad in ('P0', 'P1', 'P2', 'P3')),
  decision_nota text,
  issue_numero integer check (issue_numero > 0),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index solicitudes_area_idx on public.solicitudes (area_id, estado);

create table public.solicitud_eventos (
  id bigserial primary key,
  solicitud_id uuid not null references public.solicitudes(id) on delete cascade,
  usuario uuid default auth.uid(),
  tipo text not null,
  detalle text,
  creado_en timestamptz not null default now()
);
create index solicitud_eventos_idx on public.solicitud_eventos (solicitud_id, creado_en);

create table public.cargas (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id),
  solicitud_id uuid references public.solicitudes(id),
  subido_por uuid not null default auth.uid() references auth.users(id),
  nombre_archivo text not null check (char_length(nombre_archivo) <= 200),
  ruta text not null,
  tamano_bytes bigint check (tamano_bytes between 1 and 52428800),
  columnas jsonb,                    -- solo nombres de columnas, nunca datos
  filas_aprox integer check (filas_aprox >= 0),
  estado text not null default 'recibida'
    check (estado in ('recibida', 'validando', 'cargada', 'rechazada', 'error')),
  nota text,
  creado_en timestamptz not null default now()
);
create index cargas_area_idx on public.cargas (area_id, estado);

-- ---------- Funciones de apoyo ----------
create function public.es_propietario() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'propietario') $$;

create function public.mi_area() returns uuid
language sql stable security definer set search_path = ''
as $$ select p.area_id from public.perfiles p where p.id = auth.uid() and p.rol = 'area' $$;

-- ---------- Reglas de estado y bitácora ----------
create function public.solicitudes_antes_de_actualizar() returns trigger
language plpgsql set search_path = ''
as $$
declare permitido boolean;
begin
  permitido := case old.estado
    when 'recibida'           then new.estado in ('recibida', 'en_analisis', 'rechazada')
    when 'en_analisis'        then new.estado in ('en_analisis', 'pendiente_decision', 'rechazada')
    when 'pendiente_decision' then new.estado in ('pendiente_decision', 'aprobada', 'rechazada', 'en_analisis')
    when 'aprobada'           then new.estado in ('aprobada', 'en_ejecucion', 'cerrada')
    when 'en_ejecucion'       then new.estado in ('en_ejecucion', 'cerrada')
    else new.estado = old.estado   -- cerrada y rechazada son finales
  end;
  if not permitido then
    raise exception 'Transición de estado no permitida: % -> %', old.estado, new.estado;
  end if;
  if new.estado = 'aprobada' and (new.prioridad is null or new.decision_nota is null) then
    raise exception 'Aprobar requiere prioridad y nota de decisión';
  end if;
  new.area_id := old.area_id;          -- inmutables
  new.creado_por := old.creado_por;
  new.creado_en := old.creado_en;
  new.actualizado_en := now();
  return new;
end $$;
create trigger solicitudes_bu before update on public.solicitudes
  for each row execute function public.solicitudes_antes_de_actualizar();

create function public.solicitudes_bitacora() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.solicitud_eventos (solicitud_id, tipo, detalle) values (new.id, 'creada', new.estado);
  elsif new.estado is distinct from old.estado then
    insert into public.solicitud_eventos (solicitud_id, tipo, detalle) values (new.id, 'estado', old.estado || ' -> ' || new.estado);
  end if;
  return new;
end $$;
create trigger solicitudes_ai after insert or update on public.solicitudes
  for each row execute function public.solicitudes_bitacora();

-- ---------- Seguridad por filas ----------
alter table public.areas enable row level security;
alter table public.perfiles enable row level security;
alter table public.solicitudes enable row level security;
alter table public.solicitud_eventos enable row level security;
alter table public.cargas enable row level security;

create policy areas_leer on public.areas for select to authenticated using (true);
create policy areas_admin on public.areas for all to authenticated
  using (public.es_propietario()) with check (public.es_propietario());

create policy perfiles_leer_propio on public.perfiles for select to authenticated
  using (id = auth.uid() or public.es_propietario());
create policy perfiles_admin on public.perfiles for all to authenticated
  using (public.es_propietario()) with check (public.es_propietario());

create policy solicitudes_leer on public.solicitudes for select to authenticated
  using (public.es_propietario() or area_id = public.mi_area());
create policy solicitudes_crear on public.solicitudes for insert to authenticated
  with check (creado_por = auth.uid() and estado = 'recibida' and prioridad is null
              and decision_nota is null and issue_numero is null
              and (public.es_propietario() or area_id = public.mi_area()));
create policy solicitudes_decidir on public.solicitudes for update to authenticated
  using (public.es_propietario()) with check (public.es_propietario());

create policy eventos_leer on public.solicitud_eventos for select to authenticated
  using (exists (select 1 from public.solicitudes s where s.id = solicitud_id
                 and (public.es_propietario() or s.area_id = public.mi_area())));

create policy cargas_leer on public.cargas for select to authenticated
  using (public.es_propietario() or area_id = public.mi_area());
create policy cargas_crear on public.cargas for insert to authenticated
  with check (subido_por = auth.uid() and estado = 'recibida'
              and split_part(ruta, '/', 1) = area_id::text
              and (public.es_propietario() or area_id = public.mi_area()));
create policy cargas_gestionar on public.cargas for update to authenticated
  using (public.es_propietario()) with check (public.es_propietario());

-- ---------- Permisos ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon;
grant select on public.areas, public.perfiles, public.solicitud_eventos to authenticated;
grant insert, update, delete on public.areas, public.perfiles to authenticated;   -- limitado por RLS al Propietario
grant select, insert, update on public.solicitudes, public.cargas to authenticated;

-- ---------- Áreas ----------
-- No se crean áreas aquí: el Propietario aporta el listado oficial. Ejemplo para agregar una:
--   insert into public.areas (codigo, nombre) values ('cartera', 'Cartera');

-- ---------- Almacenamiento privado de Excel (solo en Supabase) ----------
do $$
begin
  if to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public) values ('cargas', 'cargas', false)
      on conflict (id) do update set public = false;
    execute $p$create policy cargas_archivos_leer on storage.objects for select to authenticated
      using (bucket_id = 'cargas' and (public.es_propietario() or split_part(name, '/', 1) = public.mi_area()::text))$p$;
    execute $p$create policy cargas_archivos_subir on storage.objects for insert to authenticated
      with check (bucket_id = 'cargas' and (public.es_propietario() or split_part(name, '/', 1) = public.mi_area()::text))$p$;
  end if;
end $$;
