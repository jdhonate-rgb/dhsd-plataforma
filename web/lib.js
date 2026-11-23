// Lógica pura (sin acceso a la página ni a la red): se prueba con `npm test`.

export const ESTADOS = {
  recibida: 'Recibida',
  en_analisis: 'En análisis',
  pendiente_decision: 'Pendiente de decisión',
  aprobada: 'Aprobada',
  en_ejecucion: 'En ejecución',
  cerrada: 'Cerrada',
  rechazada: 'Rechazada',
};

// Debe coincidir con el trigger de la base de datos (supabase/migrations/0001_base.sql).
const TRANSICIONES = {
  recibida: ['en_analisis', 'rechazada'],
  en_analisis: ['pendiente_decision', 'rechazada'],
  pendiente_decision: ['aprobada', 'rechazada', 'en_analisis'],
  aprobada: ['en_ejecucion', 'cerrada'],
  en_ejecucion: ['cerrada'],
  cerrada: [],
  rechazada: [],
};

export const SENSIBILIDAD = {
  ninguna: 'Ninguna',
  interna: 'Información interna',
  personal: 'Datos personales',
  financiera: 'Datos financieros',
  clinica: 'Datos clínicos',
};

export function siguientesEstados(estado) {
  return TRANSICIONES[estado] ? [...TRANSICIONES[estado]] : [];
}

const REQUERIDOS = [
  ['titulo', 'El título', 5],
  ['proceso_actual', 'El proceso actual', 10],
  ['problema', 'El problema o necesidad', 10],
  ['resultados_esperados', 'Los resultados esperados', 10],
];

export function validarSolicitud(s) {
  const errores = [];
  for (const [campo, nombre, min] of REQUERIDOS) {
    const v = String(s?.[campo] ?? '').trim();
    if (v.length < min) errores.push(`${nombre} es obligatorio (mínimo ${min} caracteres).`);
  }
  if (String(s?.titulo ?? '').length > 160) errores.push('El título no puede pasar de 160 caracteres.');
  if (!s?.area_id) errores.push('Falta el área.');
  if (!Object.hasOwn(SENSIBILIDAD, s?.sensibilidad)) errores.push('Indica qué tipo de información maneja.');
  return errores;
}

export function validarDecision(estadoActual, nuevo, { prioridad, nota } = {}) {
  if (!siguientesEstados(estadoActual).includes(nuevo)) return `No se puede pasar de «${ESTADOS[estadoActual]}» a «${ESTADOS[nuevo]}».`;
  if (nuevo === 'aprobada' && (!prioridad || !String(nota ?? '').trim())) return 'Para aprobar indica la prioridad y una nota de decisión.';
  return null;
}

export function resumenTablero(solicitudes, ahora = Date.now(), diasAlerta = 7) {
  const porEstado = Object.fromEntries(Object.keys(ESTADOS).map((e) => [e, 0]));
  const porArea = {};
  const estancadas = [];
  for (const s of solicitudes) {
    porEstado[s.estado] = (porEstado[s.estado] ?? 0) + 1;
    porArea[s.area_id] = (porArea[s.area_id] ?? 0) + 1;
    const abierta = !['cerrada', 'rechazada'].includes(s.estado);
    const dias = (ahora - new Date(s.actualizado_en).getTime()) / 86400000;
    if (abierta && dias >= diasAlerta) estancadas.push({ id: s.id, titulo: s.titulo, estado: s.estado, dias: Math.floor(dias) });
  }
  return { total: solicitudes.length, porEstado, porArea, estancadas };
}

const MAX_BYTES = 50 * 1024 * 1024;
const EXT_OK = /\.(xlsx|xls|csv)$/i;

export function validarArchivo(nombre, tamano) {
  if (!EXT_OK.test(nombre ?? '')) return 'Solo se aceptan archivos .xlsx, .xls o .csv.';
  if (!(tamano > 0)) return 'El archivo está vacío.';
  if (tamano > MAX_BYTES) return 'El archivo supera 50 MB.';
  return null;
}

export function nombreSeguro(nombre) {
  const limpio = String(nombre).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._]+/, '').slice(-120);
  return limpio || 'archivo';
}

// A partir de las filas de una hoja (arreglo de arreglos) devuelve SOLO los nombres de columna y el conteo.
export function extraerColumnas(filas) {
  const idx = filas.findIndex((f) => Array.isArray(f) && f.some((c) => String(c ?? '').trim() !== ''));
  if (idx < 0) return { columnas: [], filas: 0 };
  const columnas = filas[idx].map((c) => String(c ?? '').trim()).filter(Boolean);
  const datos = filas.slice(idx + 1).filter((f) => Array.isArray(f) && f.some((c) => String(c ?? '').trim() !== ''));
  return { columnas, filas: datos.length };
}
