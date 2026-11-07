import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByValue, hasUndoableChanges, readLastEffect } from './task-undo.ts';

test('readLastEffect lee lo bien formado y descarta lo demás', () => {
  const effect = readLastEffect({
    last_effect: {
      at: '2026-10-17T12:00:00Z',
      water: [{ id: 1, last_water: '2026-10-10' }, { id: 2, last_water: null }, { id: 'x', last_water: 'a' }],
      archived: [3, -1, 'y', 4],
      stage: { column: 'date_floracion', plants: [{ id: 5, stage: 'Vegetativo', stage_updated_at: null, date: null }, { id: 6 }] },
      cycles: [{ id: 7, space_id: null }, { id: 8, space_id: 'z' }],
      plants: [{ id: 9, cycle_id: 10 }],
    },
  });
  assert.deepEqual(effect, {
    at: '2026-10-17T12:00:00Z',
    water: [{ id: 1, last_water: '2026-10-10' }, { id: 2, last_water: null }],
    archived: [3, 4],
    stage: { column: 'date_floracion', plants: [{ id: 5, stage: 'Vegetativo', stage_updated_at: null, date: null }] },
    cycles: [{ id: 7, space_id: null }],
    plants: [{ id: 9, cycle_id: 10 }],
  });
});

test('readLastEffect sin datos devuelve null', () => {
  assert.equal(readLastEffect(null), null);
  assert.equal(readLastEffect({}), null);
  assert.equal(readLastEffect({ last_effect: { water: [] } }), null);
});

test('hasUndoableChanges', () => {
  assert.equal(hasUndoableChanges(null), false);
  assert.equal(hasUndoableChanges({ at: 'x', water: [] }), false);
  assert.equal(hasUndoableChanges({ at: 'x', archived: [1] }), true);
  assert.equal(hasUndoableChanges({ at: 'x', stage: { column: 'c', plants: [] } }), false);
});

test('readLastEffect - lo que escribió la tarea, para revertir sólo si sigue igual', () => {
  const effect = readLastEffect({
    last_effect: {
      at: '2026-11-07T12:00:00Z',
      water: [{ id: 1, last_water: '2026-11-01' }],
      waterSet: '2026-11-07',
      stage: {
        column: 'date_secado',
        plants: [{ id: 5, stage: 'Floración', stage_updated_at: null, date: null }],
        set: { stage: 'Secado', at: '2026-11-07T15:00:00.000Z' },
      },
      cycles: [{ id: 13, space_id: 8, to: 9 }, { id: 14, space_id: 8, to: 'x' }],
      plants: [{ id: 56, cycle_id: 13, to: 17 }, { id: 57, cycle_id: null, to: null }],
      createdCycle: 21,
      harvests: [5, 'x', -2, 6],
    },
  });
  assert.deepEqual(effect, {
    at: '2026-11-07T12:00:00Z',
    water: [{ id: 1, last_water: '2026-11-01' }],
    waterSet: '2026-11-07',
    stage: {
      column: 'date_secado',
      plants: [{ id: 5, stage: 'Floración', stage_updated_at: null, date: null }],
      set: { stage: 'Secado', at: '2026-11-07T15:00:00.000Z' },
    },
    // Un `to` que no se entiende se descarta: ese ciclo se revierte sin filtro.
    cycles: [{ id: 13, space_id: 8, to: 9 }, { id: 14, space_id: 8 }],
    plants: [{ id: 56, cycle_id: 13, to: 17 }, { id: 57, cycle_id: null, to: null }],
    createdCycle: 21,
    harvests: [5, 6],
  });
});

test('readLastEffect - un last_effect de antes (sin lo escrito) se lee igual', () => {
  const effect = readLastEffect({ last_effect: { at: 'x', cycles: [{ id: 17, space_id: 9 }] } });
  assert.deepEqual(effect, { at: 'x', cycles: [{ id: 17, space_id: 9 }] });
});

test('hasUndoableChanges - fichas de cosecha y ciclo creado también cuentan', () => {
  assert.equal(hasUndoableChanges({ at: 'x', harvests: [3] }), true);
  assert.equal(hasUndoableChanges({ at: 'x', createdCycle: 9 }), true);
  assert.equal(hasUndoableChanges({ at: 'x', harvests: [] }), false);
});

test('groupByValue junta los ids con el mismo valor', () => {
  assert.deepEqual(
    groupByValue([
      { id: 1, value: '2026-10-10' },
      { id: 2, value: null },
      { id: 3, value: '2026-10-10' },
    ]),
    [
      { value: '2026-10-10', ids: [1, 3] },
      { value: null, ids: [2] },
    ]
  );
});

test('readLastEffect - registros de bitácora y stock de una mezcla', () => {
  const effect = readLastEffect({
    last_effect: {
      at: '2026-11-07T12:00:00Z',
      logs: [11, 12, 'x', 0],
      stock: [{ fertilizer_id: 1, delta: -50 }, { fertilizer_id: 2, delta: 0 }, { fertilizer_id: 'y', delta: -3 }],
    },
  });
  assert.deepEqual(effect, { at: '2026-11-07T12:00:00Z', logs: [11, 12], stock: [{ fertilizer_id: 1, delta: -50 }] });
  assert.equal(hasUndoableChanges(effect), true);
  assert.equal(hasUndoableChanges({ at: 'x', logs: [], stock: [] }), false);
});
