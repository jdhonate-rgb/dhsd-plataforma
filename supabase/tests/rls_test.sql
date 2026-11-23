-- Pruebas de seguridad. Requiere 00_stub_supabase.sql y la migración 0001 ya aplicadas.
-- Uso: psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
\set ON_ERROR_STOP on
begin;
insert into public.areas (codigo, nombre) values ('cartera', 'Cartera (prueba)'), ('laboratorio-clinico', 'Laboratorio (prueba)');
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),  -- propietario
  ('00000000-0000-0000-0000-0000000000b1'),  -- cartera
  ('00000000-0000-0000-0000-0000000000c1');  -- laboratorio
insert into public.perfiles (id, rol, area_id, nombre) values
  ('00000000-0000-0000-0000-0000000000a1', 'propietario', null, 'Propietario'),
  ('00000000-0000-0000-0000-0000000000b1', 'area', (select id from public.areas where codigo = 'cartera'), 'Cartera'),
  ('00000000-0000-0000-0000-0000000000c1', 'area', (select id from public.areas where codigo = 'laboratorio-clinico'), 'Lab');

create temp table res (prueba text, ok boolean);
grant all on res to authenticated, anon;

-- Cartera crea una solicitud propia
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
insert into public.solicitudes (area_id, titulo, proceso_actual, problema, resultados_esperados)
  values ((select id from public.areas where codigo = 'cartera'), 'Control de cartera vencida', 'Excel manual', 'Lento', 'Tablero');
insert into res values ('cartera crea solicitud propia', (select count(*) = 1 from public.solicitudes));

-- Cartera NO puede crear para otra área
do $$ begin
  begin
    insert into public.solicitudes (area_id, titulo, proceso_actual, problema, resultados_esperados)
      values ((select id from public.areas where codigo = 'laboratorio-clinico'), 'Intento ajeno', 'x', 'x', 'x');
    insert into res values ('cartera no crea para otra área', false);
  exception when insufficient_privilege or check_violation then
    insert into res values ('cartera no crea para otra área', true);
  end;
end $$;

-- Cartera NO puede autoaprobar
do $$ declare n int; begin
  update public.solicitudes set estado = 'aprobada', prioridad = 'P1', decision_nota = 'yo';
  get diagnostics n = row_count;
  insert into res values ('cartera no cambia estados', n = 0);
end $$;

-- Laboratorio no ve lo de Cartera
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
insert into res values ('laboratorio no ve solicitudes de cartera', (select count(*) = 0 from public.solicitudes));
insert into res values ('laboratorio no ve eventos de cartera', (select count(*) = 0 from public.solicitud_eventos));

-- Carga: ruta debe empezar por el área propia
do $$ begin
  begin
    insert into public.cargas (area_id, nombre_archivo, ruta, tamano_bytes)
      values ((select id from public.areas where codigo = 'laboratorio-clinico'), 'x.xlsx', 'otra-area/x.xlsx', 100);
    insert into res values ('ruta de carga debe coincidir con el área', false);
  exception when insufficient_privilege or check_violation then
    insert into res values ('ruta de carga debe coincidir con el área', true);
  end;
end $$;
insert into public.cargas (area_id, nombre_archivo, ruta, tamano_bytes)
  select id, 'cartera.xlsx', id::text || '/cartera.xlsx', 1000 from public.areas where codigo = 'laboratorio-clinico';
insert into res values ('laboratorio sube carga propia', (select count(*) = 1 from public.cargas));

-- Un usuario registrado SIN perfil no ve nada
reset role;
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000d1');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
insert into res values ('usuario sin perfil no ve áreas', (select count(*) = 0 from public.areas));
insert into res values ('usuario sin perfil no ve solicitudes', (select count(*) = 0 from public.solicitudes));
do $$ begin
  begin
    insert into public.solicitudes (area_id, titulo, proceso_actual, problema, resultados_esperados)
      values ((select id from public.areas where codigo = 'cartera'), 'Intento sin perfil', 'x', 'x', 'x');
    insert into res values ('usuario sin perfil no crea solicitudes', false);
  exception when insufficient_privilege or check_violation then
    insert into res values ('usuario sin perfil no crea solicitudes', true);
  end;
end $$;

-- Anónimo no ve nada
set local role anon;
do $$ begin
  begin
    perform count(*) from public.solicitudes;
    insert into res values ('anónimo sin acceso', false);
  exception when insufficient_privilege then
    insert into res values ('anónimo sin acceso', true);
  end;
end $$;

-- Propietario ve todo y decide, con reglas de transición
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
insert into res values ('propietario ve todo', (select count(*) = 1 from public.solicitudes) and (select count(*) = 1 from public.cargas));
do $$ begin
  begin
    update public.solicitudes set estado = 'aprobada', prioridad = 'P1', decision_nota = 'x';
    insert into res values ('no se salta de recibida a aprobada', false);
  exception when raise_exception then
    insert into res values ('no se salta de recibida a aprobada', true);
  end;
end $$;
update public.solicitudes set estado = 'en_analisis';
update public.solicitudes set estado = 'pendiente_decision';
do $$ begin
  begin
    update public.solicitudes set estado = 'aprobada';
    insert into res values ('aprobar exige prioridad y nota', false);
  exception when raise_exception then
    insert into res values ('aprobar exige prioridad y nota', true);
  end;
end $$;
update public.solicitudes set estado = 'aprobada', prioridad = 'P2', decision_nota = 'Aprobada para planificación';
insert into res values ('bitácora registra 4 eventos', (select count(*) = 4 from public.solicitud_eventos));

reset role;
select prueba, case when ok then 'OK' else 'FALLA' end as resultado from res order by 1;
do $$ begin
  if exists (select 1 from res where not ok) then raise exception 'Hay pruebas de seguridad fallidas'; end if;
end $$;
rollback;
