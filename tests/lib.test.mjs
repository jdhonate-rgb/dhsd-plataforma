import test from 'node:test';
import assert from 'node:assert/strict';
import { siguientesEstados, validarSolicitud, validarDecision, resumenTablero, validarArchivo, nombreSeguro, extraerColumnas } from '../web/lib.js';

const ok = { area_id: 'a', titulo: 'Control de cartera', proceso_actual: 'Se hace en Excel a mano', problema: 'Tarda medio día', resultados_esperados: 'Un tablero', sensibilidad: 'financiera' };

test('solicitud válida no tiene errores', () => assert.deepEqual(validarSolicitud(ok), []));
test('solicitud incompleta lista errores', () => {
  assert.ok(validarSolicitud({ ...ok, titulo: 'abc' }).length === 1);
  assert.ok(validarSolicitud({ ...ok, area_id: '' }).length === 1);
  assert.ok(validarSolicitud({ ...ok, sensibilidad: 'x' }).length === 1);
});
test('transiciones de estado', () => {
  assert.deepEqual(siguientesEstados('recibida'), ['en_analisis', 'rechazada']);
  assert.deepEqual(siguientesEstados('cerrada'), []);
  assert.deepEqual(siguientesEstados('inexistente'), []);
});
test('aprobar exige prioridad y nota; no se salta pasos', () => {
  assert.match(validarDecision('pendiente_decision', 'aprobada', {}), /prioridad/);
  assert.equal(validarDecision('pendiente_decision', 'aprobada', { prioridad: 'P1', nota: 'ok' }), null);
  assert.match(validarDecision('recibida', 'aprobada', { prioridad: 'P1', nota: 'ok' }), /No se puede/);
});
test('tablero cuenta y detecta estancadas', () => {
  const ahora = Date.parse('2026-11-22T00:00:00Z');
  const r = resumenTablero([
    { id: '1', titulo: 'a', area_id: 'x', estado: 'en_analisis', actualizado_en: '2026-11-01T00:00:00Z' },
    { id: '2', titulo: 'b', area_id: 'x', estado: 'cerrada', actualizado_en: '2026-10-01T00:00:00Z' },
    { id: '3', titulo: 'c', area_id: 'y', estado: 'recibida', actualizado_en: '2026-11-21T00:00:00Z' },
  ], ahora);
  assert.equal(r.total, 3); assert.equal(r.porArea.x, 2); assert.equal(r.estancadas.length, 1); assert.equal(r.estancadas[0].id, '1');
});
test('archivos', () => {
  assert.equal(validarArchivo('a.xlsx', 10), null);
  assert.match(validarArchivo('a.exe', 10), /Solo/);
  assert.match(validarArchivo('a.csv', 0), /vacío/);
  assert.match(validarArchivo('a.csv', 60 * 1024 * 1024), /50 MB/);
  assert.equal(nombreSeguro('../Reporte Cartera ñ.xlsx'), 'Reporte_Cartera_n.xlsx');
  assert.equal(nombreSeguro('...'), 'archivo');
});
test('extraerColumnas devuelve solo encabezados y conteo', () => {
  const r = extraerColumnas([[], ['Código', 'Valor', ''], ['1', 100], ['', ''], ['2', 200]]);
  assert.deepEqual(r, { columnas: ['Código', 'Valor'], filas: 2 });
  assert.deepEqual(extraerColumnas([]), { columnas: [], filas: 0 });
});
