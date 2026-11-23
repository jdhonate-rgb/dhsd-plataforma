import config from './config.js';
import { crearDatos } from './datos.js';
import { ESTADOS, SENSIBILIDAD, siguientesEstados, validarSolicitud, validarDecision, resumenTablero, validarArchivo, extraerColumnas } from './lib.js';

const $app = document.getElementById('app');
const $nav = document.getElementById('nav');
const $usuario = document.getElementById('usuario');
let datos, sesion, areas = [], vista = 'panel';

// Creación segura de elementos: todo texto entra por textContent (sin innerHTML).
function h(tag, attrs = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const fecha = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
const nombreArea = (id) => areas.find((a) => a.id === id)?.nombre ?? '—';
const pill = (estado) => h('span', { class: 'pill ' + estado }, ESTADOS[estado] ?? estado);
let tt;
function aviso(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('ver'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('ver'), 3500); }
async function seguro(fn) { try { return await fn(); } catch (e) { aviso(e.message || 'Ocurrió un error'); console.error(e); } }

function pintarCabecera() {
  $nav.replaceChildren();
  $usuario.replaceChildren();
  if (!sesion) return;
  const items = [['panel', sesion.rol === 'propietario' ? 'Tablero' : 'Mis solicitudes'], ['nueva', 'Nueva solicitud'], ['cargas', 'Cargar Excel']];
  for (const [id, txt] of items) $nav.append(h('button', { 'aria-current': vista === id ? 'page' : false, onclick: () => { vista = id; ir(); } }, txt));
  $usuario.append(h('span', {}, sesion.nombre), h('button', { class: 'sec', onclick: async () => { await datos.cerrarSesion(); sesion = null; ir(); } }, 'Salir'));
}

async function ir() {
  pintarCabecera();
  $app.replaceChildren();
  if (!sesion) return pantallaIngreso();
  if (vista === 'panel') return seguro(pantallaPanel);
  if (vista === 'nueva') return pantallaNueva();
  if (vista === 'cargas') return seguro(pantallaCargas);
}

function pantallaIngreso() {
  const err = h('p', { class: 'error', role: 'alert' });
  let caja;
  if (datos.modo === 'demo') {
    caja = h('div', { class: 'tarj centro' }, h('h1', {}, 'Probar la plataforma'),
      h('p', { class: 'sub' }, 'Elige con qué perfil quieres ver la plataforma. Los datos son de ejemplo.'),
      h('div', { class: 'fila-btn' },
        h('button', { class: 'pri', onclick: async () => { sesion = await datos.iniciarSesion('propietario'); vista = 'panel'; ir(); } }, 'Entrar como Propietario'),
        h('button', { class: 'sec', onclick: async () => { sesion = await datos.iniciarSesion('area'); vista = 'panel'; ir(); } }, 'Entrar como usuario de un área')));
  } else {
    const email = h('input', { type: 'email', required: true, autocomplete: 'username' });
    const clave = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
    caja = h('form', { class: 'tarj centro', onsubmit: async (e) => { e.preventDefault(); err.textContent = ''; try { sesion = await datos.iniciarSesion(email.value.trim(), clave.value); vista = 'panel'; ir(); } catch (x) { err.textContent = x.message; } } },
      h('h1', {}, 'Ingresar'), h('label', {}, 'Correo', email), h('label', {}, 'Contraseña', clave), err,
      h('div', { class: 'fila-btn' }, h('button', { class: 'pri', type: 'submit' }, 'Entrar')));
  }
  $app.append(caja);
}

// ---------- Tablero / lista ----------
let filtro = null, abierta = null;
async function pantallaPanel() {
  const todas = await datos.solicitudes();
  const esProp = sesion.rol === 'propietario';
  const r = resumenTablero(todas);
  const lista = filtro ? todas.filter((s) => s.estado === filtro) : todas;
  const fichas = h('div', { class: 'fichas' }, h('button', { class: 'ficha', 'aria-pressed': filtro === null, onclick: () => { filtro = null; ir(); } }, h('b', {}, r.total), 'Todas'),
    ...Object.entries(ESTADOS).map(([k, v]) => h('button', { class: 'ficha', 'aria-pressed': filtro === k, onclick: () => { filtro = k; ir(); } }, h('b', {}, r.porEstado[k]), v)));
  const alerta = esProp && r.estancadas.length ? h('div', { class: 'alerta' }, h('b', {}, `${r.estancadas.length} solicitud(es) llevan 7 días o más sin moverse: `), r.estancadas.map((e) => `${e.titulo} (${e.dias} d)`).join(' · ')) : null;
  const tabla = h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Solicitud'), h('th', { class: 'ocultar-m' }, 'Área'), h('th', {}, 'Estado'), h('th', { class: 'ocultar-m' }, 'Actualizada'))),
    h('tbody', {}, lista.length ? lista.map((s) => h('tr', { class: 'clic', tabindex: 0, onclick: () => { abierta = s.id; ir(); }, onkeydown: (e) => { if (e.key === 'Enter') { abierta = s.id; ir(); } } },
      h('td', {}, s.titulo), h('td', { class: 'ocultar-m' }, nombreArea(s.area_id)), h('td', {}, pill(s.estado)), h('td', { class: 'ocultar-m' }, fecha(s.actualizado_en))))
      : h('tr', {}, h('td', { colspan: 4, class: 'sub' }, 'No hay solicitudes en este estado.'))));
  const izq = h('div', {}, h('h1', {}, esProp ? 'Tablero de solicitudes' : 'Mis solicitudes'), fichas, alerta, h('div', { class: 'tarj' }, tabla));
  const sel = todas.find((s) => s.id === abierta);
  $app.append(h('div', { class: sel ? 'dos' : '' }, izq, sel ? await detalle(sel, esProp) : null));
}

async function detalle(s, esProp) {
  const evs = await datos.eventos(s.id);
  const campo = (t, v) => (v ? [h('dt', {}, t), h('dd', {}, v)] : []);
  const caja = h('aside', { class: 'tarj' }, h('h2', {}, s.titulo), h('p', {}, pill(s.estado), ' ', h('span', { class: 'sub' }, `${nombreArea(s.area_id)} · ${fecha(s.creado_en)}`)),
    h('dl', {}, campo('Proceso actual', s.proceso_actual), campo('Problema o necesidad', s.problema), campo('Resultados esperados', s.resultados_esperados), campo('Indicadores', s.indicadores), campo('Alertas', s.alertas), campo('Usuarios y roles', s.usuarios_roles),
      campo('Información que maneja', SENSIBILIDAD[s.sensibilidad]), campo('Volumen aproximado', s.volumen_aprox), campo('Prioridad', s.prioridad), campo('Decisión', s.decision_nota), campo('Issue en GitHub', s.issue_numero ? '#' + s.issue_numero : '')),
    h('h2', {}, 'Historial'), ...evs.map((e) => h('div', { class: 'linea' }, `${fecha(e.creado_en)} — ${e.tipo === 'creada' ? 'Creada' : e.detalle.replace(/(\w+) -> (\w+)/, (_, a, b) => `${ESTADOS[a] ?? a} → ${ESTADOS[b] ?? b}`)}`)));
  if (esProp) {
    const sig = siguientesEstados(s.estado);
    const prio = h('select', {}, h('option', { value: '' }, 'Prioridad…'), ...['P0', 'P1', 'P2', 'P3'].map((p) => h('option', { value: p, selected: s.prioridad === p }, p)));
    const nota = h('textarea', { placeholder: 'Nota de decisión (obligatoria para aprobar)' }, s.decision_nota ?? '');
    const issue = h('input', { type: 'number', min: 1, placeholder: 'N.º de Issue en GitHub', value: s.issue_numero ?? '' });
    const mover = (nuevo) => seguro(async () => {
      const patch = { estado: nuevo, prioridad: prio.value || null, decision_nota: nota.value.trim() || null, issue_numero: issue.value ? Number(issue.value) : null };
      const e = validarDecision(s.estado, nuevo, { prioridad: patch.prioridad, nota: patch.decision_nota });
      if (e) return aviso(e);
      await datos.decidir(s.id, patch); aviso('Estado actualizado'); ir();
    });
    caja.append(h('h2', {}, 'Decisión del Propietario'), prio, nota, issue,
      h('div', { class: 'fila-btn' }, sig.length ? sig.map((n) => h('button', { class: n === 'rechazada' ? 'pel' : 'pri', onclick: () => mover(n) }, '→ ' + ESTADOS[n])) : h('span', { class: 'sub' }, 'Estado final.')));
  }
  caja.append(h('div', { class: 'fila-btn' }, h('button', { class: 'sec', onclick: () => { abierta = null; ir(); } }, 'Cerrar detalle')));
  return caja;
}

// ---------- Nueva solicitud ----------
async function pantallaNueva() {
  areas = await datos.areas();
  const ar = sesion.rol === 'area' ? areas.filter((a) => a.id === sesion.area_id) : areas;
  const f = {};
  const txt = (id, etiqueta, ayuda, req) => { f[id] = h('textarea', { id, required: req }); return h('div', {}, h('label', { for: id }, etiqueta, h('span', { class: 'ayuda' }, ayuda)), f[id]); };
  f.area_id = h('select', { id: 'area' }, ar.map((a) => h('option', { value: a.id }, a.nombre)));
  f.titulo = h('input', { id: 'titulo', maxlength: 160, placeholder: 'Ej. Control de cartera vencida' });
  f.sensibilidad = h('select', { id: 'sens' }, Object.entries(SENSIBILIDAD).map(([k, v]) => h('option', { value: k, selected: k === 'interna' }, v)));
  f.volumen_aprox = h('input', { id: 'vol', placeholder: 'Ej. unas 5.000 filas por reporte' });
  const err = h('p', { class: 'error', role: 'alert' });
  const form = h('form', { class: 'tarj', novalidate: true, onsubmit: (e) => { e.preventDefault(); enviar(); } },
    h('p', { class: 'alerta' }, 'No escribas nombres de personas, documentos, teléfonos ni datos reales de clientes o pacientes. Describe el proceso, no los datos.'),
    h('label', { for: 'area' }, 'Área solicitante'), f.area_id,
    h('label', { for: 'titulo' }, 'Título de la solicitud'), f.titulo,
    txt('proceso_actual', 'Proceso actual, paso a paso', 'Cómo se hace hoy.', true),
    txt('problema', 'Problema o necesidad', 'Qué duele, tarda o falla.', true),
    txt('resultados_esperados', 'Resultados esperados', 'Qué debería poder hacerse o verse.', true),
    txt('indicadores', 'Indicadores, consultas y tableros deseados', 'Opcional.'),
    txt('alertas', 'Alertas y mensajes', 'Qué eventos deben avisar y a quién (por rol). Opcional.'),
    txt('usuarios_roles', 'Usuarios y roles', 'Quién usaría el módulo y qué podría hacer cada perfil. Opcional.'),
    h('label', { for: 'sens' }, 'Tipo de información que maneja'), f.sensibilidad,
    h('label', { for: 'vol' }, 'Volumen aproximado de datos'), f.volumen_aprox, err,
    h('div', { class: 'fila-btn' }, h('button', { class: 'pri', type: 'submit' }, 'Enviar solicitud')));
  async function enviar() {
    const d = Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value.trim()]));
    const e = validarSolicitud(d);
    err.textContent = e.join(' ');
    if (e.length) return;
    await seguro(async () => { await datos.crearSolicitud(d); aviso('Solicitud enviada'); vista = 'panel'; ir(); });
  }
  $app.append(h('h1', {}, 'Nueva solicitud de módulo'), form);
}

// ---------- Cargar Excel ----------
async function pantallaCargas() {
  areas = await datos.areas();
  const ar = sesion.rol === 'area' ? areas.filter((a) => a.id === sesion.area_id) : areas;
  const lista = await datos.cargas();
  let archivo = null, meta = null;
  const sel = h('select', { id: 'area-c' }, ar.map((a) => h('option', { value: a.id }, a.nombre)));
  const nota = h('input', { id: 'nota', placeholder: 'Ej. Reporte de cartera del 20 de noviembre' });
  const info = h('div', { class: 'sub' }, 'Elige un archivo para ver qué columnas trae.');
  const btn = h('button', { class: 'pri', disabled: true, onclick: () => seguro(async () => {
    btn.disabled = true; await datos.subirCarga(archivo, { area_id: sel.value, columnas: meta.columnas, filas: meta.filas, nota: nota.value.trim() || null });
    aviso('Archivo enviado'); ir();
  }) }, 'Enviar archivo');
  const entrada = h('input', { type: 'file', id: 'archivo', accept: '.xlsx,.xls,.csv', onchange: async (e) => {
    archivo = e.target.files[0]; meta = null; btn.disabled = true;
    if (!archivo) return;
    const mal = validarArchivo(archivo.name, archivo.size);
    if (mal) { info.replaceChildren(h('span', { class: 'error' }, mal)); return; }
    info.textContent = 'Leyendo columnas…';
    try {
      meta = await leerColumnas(archivo);
      info.replaceChildren(h('b', {}, `${meta.columnas.length} columnas, ${meta.filas} filas.`), h('div', { class: 'cols' }, meta.columnas.map((c) => h('span', {}, c))),
        h('div', { class: 'sub' }, 'El archivo completo se enviará a un espacio privado. Solo el Propietario lo puede abrir.'));
      btn.disabled = false;
    } catch (x) { info.replaceChildren(h('span', { class: 'error' }, 'No se pudo leer el archivo: ' + x.message)); }
  } });
  const tabla = h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Archivo'), h('th', { class: 'ocultar-m' }, 'Área'), h('th', {}, 'Estado'), h('th', { class: 'ocultar-m' }, 'Fecha'))),
    h('tbody', {}, lista.length ? lista.map((c) => h('tr', {}, h('td', {}, c.nombre_archivo, h('div', { class: 'sub' }, `${(c.columnas ?? []).length} columnas · ${c.filas_aprox ?? '?'} filas`)), h('td', { class: 'ocultar-m' }, nombreArea(c.area_id)), h('td', {}, h('span', { class: 'pill' }, c.estado)), h('td', { class: 'ocultar-m' }, fecha(c.creado_en))))
      : h('tr', {}, h('td', { colspan: 4, class: 'sub' }, 'Aún no hay archivos enviados.'))));
  $app.append(h('h1', {}, 'Cargar reporte en Excel'),
    h('div', { class: 'tarj' }, h('p', { class: 'sub' }, 'Sube aquí el reporte que genera el sistema integral. La plataforma lo valida y lo carga; tú nunca tocas la base de datos directamente.'),
      h('label', { for: 'area-c' }, 'Área'), sel, h('label', { for: 'nota' }, 'Descripción (opcional)'), nota, h('label', { for: 'archivo' }, 'Archivo (.xlsx, .xls o .csv, máx. 50 MB)'), entrada, h('div', {}, info), h('div', { class: 'fila-btn' }, btn)),
    h('h2', {}, 'Archivos enviados'), h('div', { class: 'tarj' }, tabla));
}

// Lee solo la primera hoja, en el navegador, y devuelve nombres de columna y número de filas.
async function leerColumnas(archivo) {
  if (/\.csv$/i.test(archivo.name)) {
    const t = await archivo.text();
    const filas = t.split(/\r?\n/).map((l) => l.split(/[;,\t]/));
    return extraerColumnas(filas);
  }
  if (!window.XLSX) await new Promise((ok, mal) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar el lector de Excel')); document.head.appendChild(s); });
  const libro = window.XLSX.read(await archivo.arrayBuffer(), { type: 'array', sheetRows: 5000 });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  return extraerColumnas(window.XLSX.utils.sheet_to_json(hoja, { header: 1, blankrows: false, defval: '' }));
}

// ---------- Inicio ----------
(async () => {
  try { if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js'); } catch { /* sin service worker */ }
  datos = await crearDatos(config);
  document.getElementById('aviso-demo').hidden = datos.modo !== 'demo';
  try { sesion = await datos.sesionActual(); } catch (e) { aviso(e.message); }
  if (sesion) areas = await datos.areas();
  else if (datos.modo === 'demo') areas = await datos.areas();
  ir();
})();
