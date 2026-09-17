import { test } from 'node:test';
import assert from 'node:assert';
import {
  getFirstSuggestion,
  getStageDateColumn,
  getStageSuggestion,
  STAGE_NAMES,
} from './stage-logic.ts';
import type { Plant } from './types.ts';

// Mock Plant factory
function createPlant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: 1,
    name: 'Test Plant',
    stage: 'Germinación',
    last_water: new Date().toISOString(),
    cycle_id: 1,
    ...overrides
  } as Plant;
}

test('getStageSuggestion - suggests next stage when threshold is met (Germinación)', () => {
  const plant = createPlant({ stage: 'Germinación', current_age_days: 7 });
  const result = getStageSuggestion(plant);
  assert.strictEqual(result, 'Plántula');
});

test('getStageSuggestion - suggests next stage when threshold is met (Enraizamiento)', () => {
  const plant = createPlant({ stage: 'Enraizamiento', current_age_days: 12 });
  const result = getStageSuggestion(plant);
  assert.strictEqual(result, 'Vegetativo');
});

test('getStageSuggestion - suggests next stage when threshold is exceeded', () => {
  const plant = createPlant({ stage: 'Plántula', current_age_days: 25 });
  const result = getStageSuggestion(plant);
  assert.strictEqual(result, 'Vegetativo');
});

test('getStageSuggestion - no suggestion when below threshold', () => {
  const plant = createPlant({ stage: 'Plántula', current_age_days: 20 });
  const result = getStageSuggestion(plant);
  assert.strictEqual(result, null);
});

test('getStageSuggestion - handles planted_at calculation', () => {
  const now = new Date('2024-01-10T12:00:00Z');
  const planted_at = new Date('2024-01-01T12:00:00Z').toISOString(); // 9 days ago
  const plant = createPlant({ stage: 'Germinación', planted_at });

  const result = getStageSuggestion(plant, now);
  assert.strictEqual(result, 'Plántula'); // 9 days >= 7 days
});

test('getStageSuggestion - no suggestion for unknown stage', () => {
  const plant = createPlant({ stage: 'Curado', current_age_days: 100 });
  const result = getStageSuggestion(plant);
  assert.strictEqual(result, null);
});

test('getFirstSuggestion - returns first matching plant', () => {
  const plants = [
    createPlant({ id: 1, name: 'P1', stage: 'Germinación', current_age_days: 1 }), // No
    createPlant({ id: 2, name: 'P2', stage: 'Plántula', current_age_days: 21 }), // Yes
    createPlant({ id: 3, name: 'P3', stage: 'Vegetativo', current_age_days: 60 }), // Yes
  ];

  const result = getFirstSuggestion(plants);
  assert.notStrictEqual(result, null);
  assert.strictEqual(result?.plant.id, 2);
  assert.strictEqual(result?.nextStage, 'Vegetativo');
});

test('getFirstSuggestion - returns null if no matches', () => {
  const plants = [
    createPlant({ id: 1, stage: 'Germinación', current_age_days: 1 }),
  ];
  const result = getFirstSuggestion(plants);
  assert.strictEqual(result, null);
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
