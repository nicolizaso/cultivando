import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canStillUndo, groupByValue, hasUndoableChanges, readLastEffect, UNDO_WINDOW_MS } from './task-undo.ts';

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

test('canStillUndo respeta la ventana', () => {
  const now = new Date('2026-10-17T12:00:00Z');
  const recent = { at: new Date(now.getTime() - 60_000).toISOString() };
  const old = { at: new Date(now.getTime() - UNDO_WINDOW_MS - 1).toISOString() };
  assert.equal(canStillUndo(recent, now), true);
  assert.equal(canStillUndo(old, now), false);
  assert.equal(canStillUndo({ at: 'no es fecha' }, now), false);
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
