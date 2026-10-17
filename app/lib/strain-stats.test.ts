import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstStageSuggestion, stageDurations, strainDurationIndex, strainKey, strainStats, suggestStage } from './strain-stats.ts';
import type { Plant } from './types.ts';

const now = new Date('2026-10-17T15:00:00Z');

test('strainKey - sin mayúsculas, tildes ni espacios de más', () => {
  assert.equal(strainKey('  Gorilla   Glúe '), 'gorilla glue');
  assert.equal(strainKey(''), null);
  assert.equal(strainKey(null), null);
});

test('stageDurations - sólo las etapas terminadas', () => {
  assert.deepEqual(
    stageDurations({ date_germinacion: '2026-01-01T12:00:00Z', date_vegetativo: '2026-01-11T12:00:00Z', date_floracion: '2026-03-01T12:00:00Z' }),
    { 'Germinación': 10, 'Vegetativo': 49 }
  );
  assert.deepEqual(stageDurations({ date_floracion: '2026-03-01T12:00:00Z' }), {});
});

const plants = [
  { id: 1, strain: 'Gorilla Glue', cycle_id: 1, date_vegetativo: '2026-01-01', date_floracion: '2026-02-10', date_secado: '2026-04-07' },
  { id: 2, strain: 'gorilla glue', cycle_id: 1, date_vegetativo: '2026-01-01', date_floracion: '2026-02-20', date_secado: '2026-04-15' },
  { id: 3, strain: 'Gorilla Glue', cycle_id: 2, source_type: 'Esqueje', is_archived: true, date_vegetativo: '2026-05-01' },
  { id: 4, strain: 'Amnesia', cycle_id: 2, date_vegetativo: '2026-05-01', date_floracion: '2026-06-01' },
  { id: 5, strain: null, cycle_id: 2 },
];

test('strainStats - agrupa, promedia y cuenta pérdidas', () => {
  const [gorilla, amnesia] = strainStats(plants);
  assert.equal(gorilla.name, 'Gorilla Glue');
  assert.equal(gorilla.plants, 3);
  assert.equal(gorilla.active, 2);
  assert.equal(gorilla.cycles, 2);
  assert.equal(gorilla.clones, 1);
  assert.equal(gorilla.harvested, 2);
  assert.equal(gorilla.lost, 1);
  assert.equal(Math.round((gorilla.lossRate ?? 0) * 100), 33);
  assert.deepEqual(gorilla.stages['Vegetativo'], { avg: 45, n: 2 });
  assert.deepEqual(gorilla.stages['Floración'], { avg: 55, n: 2 });
  assert.deepEqual(gorilla.toHarvest, { avg: 100, n: 2 });
  assert.equal(amnesia.lossRate, null);
});

function plant(overrides: Partial<Plant>): Plant {
  return { id: 10, name: 'P', strain: 'Gorilla Glue', stage: 'Floración', is_archived: false, ...overrides } as Plant;
}

test('suggestStage - con datos de la genética usa su promedio', () => {
  const durations = strainDurationIndex(strainStats(plants));
  // Floración promedio 55 días: a los 50 todavía no, a los 56 sí (a secado).
  assert.equal(suggestStage(plant({ date_floracion: '2026-08-28T12:00:00Z' }), now, durations), null);
  const s = suggestStage(plant({ date_floracion: '2026-08-20T12:00:00Z' }), now, durations);
  assert.equal(s?.nextStage, 'Secado');
  assert.equal(s?.basis, 'strain');
  assert.deepEqual(s?.average, { avg: 55, n: 2 });
});

test('suggestStage - sin datos suficientes vuelve a la regla general', () => {
  const durations = strainDurationIndex(strainStats(plants));
  // Amnesia tiene una sola planta: regla general (Vegetativo → Floración a los 60 días de edad).
  const s = suggestStage(plant({ strain: 'Amnesia', stage: 'Vegetativo', date_vegetativo: '2026-08-01T12:00:00Z' }), now, durations);
  assert.equal(s?.basis, 'default');
  assert.equal(s?.nextStage, 'Floración');
  // Floración sin datos: no se sugiere cosechar.
  assert.equal(suggestStage(plant({ strain: 'Amnesia', date_floracion: '2026-01-01T12:00:00Z' }), now, durations), null);
});

test('firstStageSuggestion - saltea descartadas', () => {
  const durations = strainDurationIndex(strainStats(plants));
  const list = [plant({ id: 1, date_floracion: '2026-08-01T12:00:00Z' }), plant({ id: 2, date_floracion: '2026-08-01T12:00:00Z' })];
  assert.equal(firstStageSuggestion(list, now, durations, (id) => id === 1)?.plant.id, 2);
});
