import { test } from 'node:test';
import assert from 'node:assert';
import {
  getFirstSuggestion,
  getStageDateColumn,
  getStageSuggestion,
  STAGE_NAMES,
} from './stage-logic.ts';
import type { Plant } from './types.ts';

const now = new Date('2026-10-17T15:00:00Z');

/** `planted_at` de una planta que tiene `days` días de edad respecto de `now`. */
function ageOf(days: number) {
  return { planted_at: new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString() };
}

function createPlant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: 1,
    name: 'Test Plant',
    stage: 'Germinación',
    last_water: null,
    cycle_id: 1,
    ...overrides,
  } as Plant;
}

test('getStageSuggestion - sugiere la siguiente al cumplir el umbral (Germinación)', () => {
  assert.strictEqual(getStageSuggestion(createPlant({ stage: 'Germinación', ...ageOf(7) }), now), 'Plántula');
});

test('getStageSuggestion - sugiere la siguiente al cumplir el umbral (Enraizamiento)', () => {
  assert.strictEqual(getStageSuggestion(createPlant({ stage: 'Enraizamiento', ...ageOf(12) }), now), 'Vegetativo');
});

test('getStageSuggestion - también cuando se pasó del umbral', () => {
  assert.strictEqual(getStageSuggestion(createPlant({ stage: 'Plántula', ...ageOf(25) }), now), 'Vegetativo');
});

test('getStageSuggestion - nada por debajo del umbral', () => {
  assert.strictEqual(getStageSuggestion(createPlant({ stage: 'Plántula', ...ageOf(20) }), now), null);
});

test('getStageSuggestion - la etapa sale de la línea de tiempo, no de la columna stage', () => {
  // Si ya tiene fecha de Vegetativo, no se le sugiere salir de Plántula.
  const plant = createPlant({ stage: 'Plántula', ...ageOf(30), date_vegetativo: ageOf(5).planted_at });
  assert.strictEqual(getStageSuggestion(plant, now), null);
});

test('getStageSuggestion - nada para etapas sin umbral', () => {
  assert.strictEqual(getStageSuggestion(createPlant({ stage: 'Curado', ...ageOf(100) }), now), null);
});

test('getStageSuggestion - nunca para una planta archivada', () => {
  assert.strictEqual(getStageSuggestion(createPlant({ stage: 'Germinación', ...ageOf(30), is_archived: true }), now), null);
});

test('getFirstSuggestion - devuelve la primera que corresponde', () => {
  const plants = [
    createPlant({ id: 1, name: 'P1', stage: 'Germinación', ...ageOf(1) }),
    createPlant({ id: 2, name: 'P2', stage: 'Plántula', ...ageOf(21) }),
    createPlant({ id: 3, name: 'P3', stage: 'Vegetativo', ...ageOf(60) }),
  ];

  const result = getFirstSuggestion(plants, now);
  assert.strictEqual(result?.plant.id, 2);
  assert.strictEqual(result?.nextStage, 'Vegetativo');
});

test('getFirstSuggestion - saltea las sugerencias descartadas', () => {
  const plants = [
    createPlant({ id: 2, stage: 'Plántula', ...ageOf(21) }),
    createPlant({ id: 3, stage: 'Vegetativo', ...ageOf(60) }),
  ];
  const result = getFirstSuggestion(plants, now, (id, next) => id === 2 && next === 'Vegetativo');
  assert.strictEqual(result?.plant.id, 3);
});

test('getFirstSuggestion - null si ninguna corresponde', () => {
  assert.strictEqual(getFirstSuggestion([createPlant({ id: 1, stage: 'Germinación', ...ageOf(1) })], now), null);
});

test('getStageDateColumn - devuelve la columna de cada etapa', () => {
  assert.strictEqual(getStageDateColumn('Germinación'), 'date_germinacion');
  assert.strictEqual(getStageDateColumn('Enraizamiento'), 'date_enraizamiento');
  assert.strictEqual(getStageDateColumn('Curado'), 'date_curado');
});

test('getStageDateColumn - rechaza lo que no es una etapa', () => {
  // El nombre de la etapa llega del cliente: si colara cualquier cosa, el
  // cambio en lote escribiría una columna arbitraria de la tabla.
  assert.strictEqual(getStageDateColumn('Cosechada'), null);
  assert.strictEqual(getStageDateColumn('is_archived'), null);
  assert.strictEqual(getStageDateColumn('constructor'), null);
  assert.strictEqual(getStageDateColumn('toString'), null);
  assert.strictEqual(getStageDateColumn(''), null);
  assert.strictEqual(getStageDateColumn(undefined), null);
  assert.strictEqual(getStageDateColumn(42), null);
});

test('STAGE_NAMES - las siete etapas en orden de cultivo', () => {
  assert.deepStrictEqual(STAGE_NAMES, [
    'Germinación',
    'Plántula',
    'Enraizamiento',
    'Vegetativo',
    'Floración',
    'Secado',
    'Curado',
  ]);
});

test('STAGE_NAMES - todas tienen columna de fecha', () => {
  for (const stage of STAGE_NAMES) {
    assert.ok(getStageDateColumn(stage), `${stage} sin columna de fecha`);
  }
});
