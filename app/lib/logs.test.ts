import { test } from 'node:test';
import assert from 'node:assert';
import { isPhotoLog, LOG_TYPE, normalizeLogType } from './logs.ts';

test('isPhotoLog - reconoce lo que escribe la bitácora hoy', () => {
  assert.strictEqual(isPhotoLog({ type: LOG_TYPE.photo }), true);
  assert.strictEqual(isPhotoLog({ type: 'foto' }), true);
});

test('isPhotoLog - reconoce las mayúsculas heredadas', () => {
  // La regresión concreta: la bitácora guardaba "Foto" y los dos lectores
  // comparaban contra "foto", así que ninguna foto aparecía en la ficha de la
  // planta ni en la agenda. Los registros viejos siguen con esa forma.
  assert.strictEqual(isPhotoLog({ type: 'Foto' }), true);
  assert.strictEqual(isPhotoLog({ type: ' FOTO ' }), true);
});

test('isPhotoLog - no se come otros tipos', () => {
  assert.strictEqual(isPhotoLog({ type: 'nota' }), false);
  assert.strictEqual(isPhotoLog({ type: 'Nota' }), false);
  assert.strictEqual(isPhotoLog({ type: 'riego' }), false);
  assert.strictEqual(isPhotoLog({ type: 'Cambio de Etapa' }), false);
  assert.strictEqual(isPhotoLog({ type: 'fotosintesis' }), false);
});

test('isPhotoLog - aguanta un registro sin tipo', () => {
  assert.strictEqual(isPhotoLog({ type: null }), false);
  assert.strictEqual(isPhotoLog({ type: undefined }), false);
  assert.strictEqual(isPhotoLog({}), false);
  assert.strictEqual(isPhotoLog(null), false);
  assert.strictEqual(isPhotoLog(undefined), false);
});

test('normalizeLogType - minúsculas y sin espacios', () => {
  assert.strictEqual(normalizeLogType('Cambio de Etapa'), 'cambio de etapa');
  assert.strictEqual(normalizeLogType('  Riego '), 'riego');
  assert.strictEqual(normalizeLogType(''), '');
  assert.strictEqual(normalizeLogType(null), '');
  assert.strictEqual(normalizeLogType(undefined), '');
});

test('LOG_TYPE - los valores que se escriben ya son canónicos', () => {
  // Si alguno volviera a escribirse con mayúscula, el lector dejaría de
  // encontrarlo el día que alguien compare de forma exacta.
  assert.strictEqual(normalizeLogType(LOG_TYPE.photo), LOG_TYPE.photo);
  assert.strictEqual(normalizeLogType(LOG_TYPE.note), LOG_TYPE.note);
});
