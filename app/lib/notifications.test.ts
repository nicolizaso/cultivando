import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDigest, DEFAULT_PREFS, readPrefs } from './notifications.ts';

const empty = { todayTasks: [], overdue: 0, climateAlerts: [], lowStock: [], prefs: DEFAULT_PREFS };

test('buildDigest - nada que avisar, no se manda', () => {
  assert.equal(buildDigest(empty, '2026-10-17'), null);
});

test('buildDigest - tareas, atrasadas, clima y stock en una línea', () => {
  const digest = buildDigest({
    todayTasks: [{ title: 'Riego' }, { title: 'Fertilizante' }],
    overdue: 1,
    climateAlerts: [{ cycle: 'Otoño', level: 'high', vpd: 1.85 }],
    lowStock: [{ name: 'Grow A' }],
    prefs: DEFAULT_PREFS,
  }, '2026-10-17');
  assert.deepEqual(digest, {
    title: 'Hoy: 2 tareas',
    body: 'Riego, Fertilizante · 1 atrasada · VPD alto en Otoño (1,85 kPa) · queda poco Grow A',
    url: '/',
    tag: 'resumen-2026-10-17',
  });
});

test('buildDigest - respeta lo que el usuario no quiere', () => {
  const digest = buildDigest({ ...empty, todayTasks: [{ title: 'Riego' }], lowStock: [{ name: 'Grow A' }], prefs: { ...DEFAULT_PREFS, tasks: false } }, 'x');
  assert.equal(digest?.title, 'Cultivando');
  assert.equal(digest?.url, '/fertilizers');
  assert.equal(digest?.body, 'queda poco Grow A');
});

test('buildDigest - muchas tareas se resumen', () => {
  const digest = buildDigest({ ...empty, todayTasks: ['A', 'B', 'C', 'D', 'E'].map((title) => ({ title })) }, 'x');
  assert.equal(digest?.body, 'A, B, C y 2 más');
});

test('readPrefs - por defecto todo prendido', () => {
  assert.deepEqual(readPrefs(null), DEFAULT_PREFS);
  assert.deepEqual(readPrefs({ climate: false }), { ...DEFAULT_PREFS, climate: false });
});
