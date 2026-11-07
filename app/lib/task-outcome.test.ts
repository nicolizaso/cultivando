import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCompletion, describeReopen } from './task-outcome.ts';
import type { CompletionOutcome } from './task-outcome.ts';

const empty: CompletionOutcome = { plants: 0, water: 0, archived: 0, harvests: 0, logs: 0, problems: [] };

test('riego: cuenta las plantas regadas', () => {
  const result = describeCompletion('riego', { ...empty, plants: 3, water: 3, logs: 3 });
  assert.deepEqual(result, { message: '¡Tarea completada! Se anotó el riego de 3 plantas.', tone: 'success' });
});

test('cambio de etapa: dice si las plantas ya estaban ahí', () => {
  const result = describeCompletion('cambio_etapa', { ...empty, plants: 3, stage: { stage: 'Floración', changed: 0 } });
  assert.match(result.message, /ya estaban en Floración/);
});

test('cambio de etapa: cuenta las que pasaron', () => {
  const result = describeCompletion('cambio_etapa', { ...empty, plants: 2, logs: 1, stage: { stage: 'Floración', changed: 1 } });
  assert.match(result.message, /1 planta pasó a Floración/);
});

test('cosechar: pasan a secado y tienen su ficha', () => {
  const result = describeCompletion('cosechar', { ...empty, plants: 2, logs: 2, harvests: 2, stage: { stage: 'Secado', changed: 2 } });
  assert.match(result.message, /2 plantas pasaron a Secado/);
  assert.match(result.message, /ficha de cosecha/);
});

test('declarar muerta: cuenta las archivadas', () => {
  const result = describeCompletion('muerta', { ...empty, plants: 1, archived: 1, logs: 1 });
  assert.match(result.message, /1 planta se archivó\./);
});

test('los tipos sin cambio dicen dónde quedó anotado', () => {
  const result = describeCompletion('poda', { ...empty, plants: 4, logs: 4 });
  assert.equal(result.message, '¡Tarea completada! Quedó en la bitácora de 4 plantas.');
});

test('fertilizante con mezcla: bitácora y stock bajo', () => {
  const result = describeCompletion('fertilizante', {
    ...empty, plants: 2, logs: 2, feed: { plants: 2, lowStock: [{ name: 'Grow', stock_ml: 80 }] },
  });
  assert.match(result.message, /bitácora de 2 plantas/);
  assert.match(result.message, /Queda poco: Grow \(80\)/);
});

test('mudanza: lo que se mudó y lo que no', () => {
  const moved = describeCompletion('ambiente', { ...empty, plants: 1, move: { spaceName: 'Indoor Vege', cycles: 1, plants: 0, unplaced: 0 } });
  assert.match(moved.message, /1 ciclo pasó a Indoor Vege/);
  const pending = describeCompletion('ambiente', { ...empty, plants: 1, move: { spaceName: 'Indoor Vege', cycles: 0, plants: 0, unplaced: 1 } });
  assert.match(pending.message, /1 planta no se movió/);
});

test('sin plantas activas, lo dice', () => {
  assert.match(describeCompletion('riego', empty).message, /ninguna planta activa/);
});

test('si algo falló, el aviso lo dice', () => {
  const result = describeCompletion('riego', { ...empty, plants: 2, water: 2, problems: ['No se pudo escribir la bitácora.'] });
  assert.equal(result.tone, 'error');
  assert.match(result.message, /No se pudo escribir la bitácora\./);
});

test('describeReopen: se deshizo todo', () => {
  assert.deepEqual(describeReopen({ undone: true, kept: 0, failures: 0, esquejes: 0 }), {
    message: 'Listo, se deshizo la tarea.',
    tone: 'success',
  });
});

test('describeReopen: lo que cambió después no se tocó', () => {
  const result = describeReopen({ undone: true, kept: 2, failures: 0, esquejes: 0 });
  assert.match(result.message, /2 cambios no se tocaron porque cambiaron después/);
});

test('describeReopen: sin cambios guardados sólo vuelve a pendiente', () => {
  assert.equal(describeReopen({ undone: false, kept: 0, failures: 0, esquejes: 0 }).message, 'Tarea marcada como pendiente.');
});

test('describeReopen: los esquejes se mantienen', () => {
  assert.match(describeReopen({ undone: false, kept: 0, failures: 0, esquejes: 3 }).message, /Los 3 esquejes creados se mantienen\./);
});

test('describeReopen: si algo no se pudo deshacer, avisa', () => {
  assert.equal(describeReopen({ undone: true, kept: 0, failures: 1, esquejes: 0 }).tone, 'error');
});
