// Capa de datos. Dos modos con la misma interfaz:
//  - demo: sin servidor, datos de ejemplo en memoria (no se guardan).
//  - vivo: Supabase (se activa al rellenar web/config.js).
import { nombreSeguro } from './lib.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';

function cargarScript(src) {
  return new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}

export async function crearDatos(config) {
  return config?.SUPABASE_URL && config?.SUPABASE_ANON_KEY ? crearVivo(config) : crearDemo();
}

// ---------------- Modo demostración ----------------
function crearDemo() {
  const hoy = Date.now();
  const dia = 86400000;
  const areas = [
    { id: 'a-cartera', codigo: 'cartera', nombre: 'Cartera' },
    { id: 'a-lab', codigo: 'laboratorio-clinico', nombre: 'Laboratorio clínico' },
  ];
  const iso = (d) => new Date(hoy - d * dia).toISOString();
  let seq = 10;
  const solicitudes = [
    { id: 's1', area_id: 'a-cartera', titulo: 'Control de cartera vencida por edades', proceso_actual: 'Hoy se descarga un reporte del sistema integral y se cruza a mano en Excel.', problema: 'Tarda medio día y se cometen errores al cruzar.', resultados_esperados: 'Tablero con cartera por edades y alertas de mora.', indicadores: 'Cartera vencida por rango, recaudo diario.', alertas: 'Aviso al cobrador cuando una cuota pase de 30 días.', usuarios_roles: 'Cobrador: ve su ruta. Jefe de cartera: ve todo.', sensibilidad: 'financiera', volumen_aprox: '≈ 5.000 filas por reporte', estado: 'en_analisis', prioridad: null, decision_nota: null, issue_numero: null, creado_en: iso(12), actualizado_en: iso(9) },
    { id: 's2', area_id: 'a-lab', titulo: 'Entrega de resultados por WhatsApp', proceso_actual: 'El resultado se imprime y se entrega en recepción.', problema: 'Los pacientes regresan varias veces por su resultado.', resultados_esperados: 'Aviso automático cuando el resultado esté listo.', indicadores: 'Tiempo entre toma y entrega.', alertas: 'Mensaje al paciente al validar el resultado.', usuarios_roles: 'Recepción: envía avisos. Bacteriólogo: valida.', sensibilidad: 'clinica', volumen_aprox: '≈ 200 resultados por día', estado: 'recibida', prioridad: null, decision_nota: null, issue_numero: null, creado_en: iso(2), actualizado_en: iso(2) },
    { id: 's3', area_id: 'a-cartera', titulo: 'Seguimiento de promesas de pago', proceso_actual: 'Las promesas se anotan en un cuaderno.', problema: 'Se pierden y no se puede medir su cumplimiento.', resultados_esperados: 'Registro de promesas con fecha y cumplimiento.', indicadores: '', alertas: '', usuarios_roles: '', sensibilidad: 'financiera', volumen_aprox: '', estado: 'aprobada', prioridad: 'P2', decision_nota: 'Aprobada para planificación.', issue_numero: 14, creado_en: iso(20), actualizado_en: iso(3) },
  ];
  const eventos = { s1: [{ tipo: 'creada', detalle: 'recibida', creado_en: iso(12) }, { tipo: 'estado', detalle: 'recibida -> en_analisis', creado_en: iso(9) }], s2: [{ tipo: 'creada', detalle: 'recibida', creado_en: iso(2) }], s3: [{ tipo: 'creada', detalle: 'recibida', creado_en: iso(20) }, { tipo: 'estado', detalle: 'pendiente_decision -> aprobada', creado_en: iso(3) }] };
  const cargas = [];
  let sesion = null;
  return {
    modo: 'demo',
    async iniciarSesion(rol) { sesion = rol === 'propietario' ? { rol, area_id: null, nombre: 'Propietario (demo)' } : { rol: 'area', area_id: 'a-cartera', nombre: 'Usuario de Cartera (demo)' }; return sesion; },
    async sesionActual() { return sesion; },
    async cerrarSesion() { sesion = null; },
    async areas() { return areas; },
    async solicitudes() { return solicitudes.filter((s) => sesion.rol === 'propietario' || s.area_id === sesion.area_id).map((s) => ({ ...s })); },
    async crearSolicitud(d) {
      const s = { ...d, id: 's' + ++seq, estado: 'recibida', prioridad: null, decision_nota: null, issue_numero: null, creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString() };
      solicitudes.unshift(s); eventos[s.id] = [{ tipo: 'creada', detalle: 'recibida', creado_en: s.creado_en }]; return s;
    },
    async decidir(id, patch) {
      const s = solicitudes.find((x) => x.id === id); const antes = s.estado;
      Object.assign(s, patch, { actualizado_en: new Date().toISOString() });
      if (patch.estado && patch.estado !== antes) eventos[id].push({ tipo: 'estado', detalle: `${antes} -> ${patch.estado}`, creado_en: s.actualizado_en });
      return { ...s };
    },
    async eventos(id) { return eventos[id] ?? []; },
    async cargas() { return cargas.filter((c) => sesion.rol === 'propietario' || c.area_id === sesion.area_id); },
    async subirCarga(archivo, meta) {
      const c = { id: 'c' + ++seq, area_id: meta.area_id, nombre_archivo: archivo.name, tamano_bytes: archivo.size, columnas: meta.columnas, filas_aprox: meta.filas, estado: 'recibida', nota: meta.nota ?? null, creado_en: new Date().toISOString() };
      cargas.unshift(c); return c;
    },
  };
}

// ---------------- Modo vivo (Supabase) ----------------
async function crearVivo(config) {
  if (!window.supabase) await cargarScript(SUPABASE_JS);
  const sb = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, { auth: { persistSession: true } });
  const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  let perfil = null;
  async function cargarPerfil() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return (perfil = null);
    const p = ok(await sb.from('perfiles').select('rol, area_id, nombre').eq('id', session.user.id).maybeSingle());
    if (!p) throw new Error('Tu usuario existe pero aún no tiene perfil asignado. Pídele al Propietario que lo active.');
    return (perfil = { ...p, nombre: p.nombre ?? session.user.email });
  }
  return {
    modo: 'vivo',
    async iniciarSesion(email, clave) { ok(await sb.auth.signInWithPassword({ email, password: clave })); return cargarPerfil(); },
    async sesionActual() { return perfil ?? cargarPerfil(); },
    async cerrarSesion() { await sb.auth.signOut(); perfil = null; },
    async areas() { return ok(await sb.from('areas').select('id, codigo, nombre').eq('activa', true).order('nombre')); },
    async solicitudes() { return ok(await sb.from('solicitudes').select('*').order('actualizado_en', { ascending: false })); },
    async crearSolicitud(d) { return ok(await sb.from('solicitudes').insert(d).select().single()); },
    async decidir(id, patch) { return ok(await sb.from('solicitudes').update(patch).eq('id', id).select().single()); },
    async eventos(id) { return ok(await sb.from('solicitud_eventos').select('tipo, detalle, creado_en').eq('solicitud_id', id).order('creado_en')); },
    async cargas() { return ok(await sb.from('cargas').select('*').order('creado_en', { ascending: false })); },
    async subirCarga(archivo, meta) {
      const ruta = `${meta.area_id}/${Date.now()}_${nombreSeguro(archivo.name)}`;
      ok(await sb.storage.from('cargas').upload(ruta, archivo, { upsert: false }));
      return ok(await sb.from('cargas').insert({ area_id: meta.area_id, nombre_archivo: archivo.name.slice(0, 200), ruta, tamano_bytes: archivo.size, columnas: meta.columnas, filas_aprox: meta.filas, nota: meta.nota ?? null }).select().single());
    },
  };
}
