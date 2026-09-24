import { test } from 'node:test';
import assert from 'node:assert';
import {
  getTaskCompletionEffect,
  getTaskEffectDate,
  HARVEST_STAGE,
  inferLegacyTargets,
  readTaskTargets,
  resolveTaskPlants,
  shouldApplyStage,
} from './task-effects.ts';
import type { StageEffect, TargetPlant } from './task-effects.ts';

test('cosechar pasa las plantas a secado, sin retroceder', () => {
  assert.deepStrictEqual(getTaskCompletionEffect({ type: 'cosechar' }), {
    kind: 'stage',
    stage: 'Secado',
    onlyForward: true,
  });
  assert.strictEqual(HARVEST_STAGE, 'Secado');
});

test('cambio_etapa usa la etapa elegida en la tarea', () => {
  assert.deepStrictEqual(getTaskCompletionEffect({ type: 'cambio_etapa', target_stage: 'Floración' }), {
    kind: 'stage',
    stage: 'Floración',
    onlyForward: false,
  });
});

test('cambio_etapa con una etapa inexistente no hace nada', () => {
  assert.strictEqual(getTaskCompletionEffect({ type: 'cambio_etapa', target_stage: 'stage; drop' }), null);
  assert.strictEqual(getTaskCompletionEffect({ type: 'cambio_etapa', target_stage: null }), null);
});

test('riego y fertilizante en riego actualizan el último riego', () => {
  assert.deepStrictEqual(getTaskCompletionEffect({ type: 'riego' }), { kind: 'water' });
  assert.deepStrictEqual(getTaskCompletionEffect({ type: 'fertilizante', application_type: 'Riego' }), { kind: 'water' });
  assert.strictEqual(getTaskCompletionEffect({ type: 'fertilizante', application_type: 'Foliar' }), null);
});

test('declarar muerta archiva la planta', () => {
  assert.deepStrictEqual(getTaskCompletionEffect({ type: 'muerta' }), { kind: 'archive' });
});

test('los tipos sin efecto devuelven null', () => {
  for (const type of ['poda', 'trasplante', 'lavado', 'otro', 'esquejado', 'ambiente', undefined]) {
    assert.strictEqual(getTaskCompletionEffect({ type }), null, `tipo ${type}`);
  }
});

test('shouldApplyStage: la cosecha sólo avanza', () => {
  const harvest: StageEffect = { kind: 'stage', stage: 'Secado', onlyForward: true };
  assert.strictEqual(shouldApplyStage('Floración', harvest), true);
  assert.strictEqual(shouldApplyStage('Vegetativo', harvest), true);
  assert.strictEqual(shouldApplyStage('Esqueje', harvest), true);
  assert.strictEqual(shouldApplyStage(null, harvest), true);
  assert.strictEqual(shouldApplyStage('Secado', harvest), false);
  assert.strictEqual(shouldApplyStage('Curado', harvest), false);
});

test('shouldApplyStage: un cambio de etapa explícito puede retroceder', () => {
  const back: StageEffect = { kind: 'stage', stage: 'Vegetativo', onlyForward: false };
  assert.strictEqual(shouldApplyStage('Floración', back), true);
  assert.strictEqual(shouldApplyStage('Vegetativo', back), false);
});

test('getTaskEffectDate: usa el día agendado, no el de tildarla', () => {
  const now = new Date('2026-09-24T20:48:15.522Z');
  assert.strictEqual(getTaskEffectDate('2026-09-19T12:00:00+00:00', now), '2026-09-19T12:00:00.000Z');
});

test('getTaskEffectDate: completada antes de tiempo o sin fecha, usa ahora', () => {
  const now = new Date('2026-09-24T20:48:15.522Z');
  assert.strictEqual(getTaskEffectDate('2026-10-05T12:00:00+00:00', now), now.toISOString());
  assert.strictEqual(getTaskEffectDate(null, now), now.toISOString());
  assert.strictEqual(getTaskEffectDate('cualquier cosa', now), now.toISOString());
});

test('readTaskTargets lee metadata.targets y rechaza lo que no entiende', () => {
  assert.deepStrictEqual(readTaskTargets({ targets: { cycle_ids: [9, '9'], plant_ids: [] } }), {
    cycle_ids: [9],
    plant_ids: [],
  });
  assert.strictEqual(readTaskTargets(null), null);
  assert.strictEqual(readTaskTargets({ esquejado: {} }), null);
  assert.strictEqual(readTaskTargets({ targets: { cycle_ids: 9 } }), null);
});

// El ciclo 9 tenía 29, 39, 40 y 41 al agendar la cosecha; después entró la 50
// desde el ciclo 13, y la 40 se archivó.
const cycle9: TargetPlant[] = [
  { id: 29, cycle_id: 9, stage: 'Floración' },
  { id: 39, cycle_id: 9, stage: 'Floración' },
  { id: 40, cycle_id: 9, stage: 'Floración', is_archived: true },
  { id: 41, cycle_id: 9, stage: 'Floración' },
  { id: 50, cycle_id: 9, stage: 'Floración' },
];

test('tarea vieja de un ciclo entero: alcanza a la planta que llegó después', () => {
  const linked = cycle9.filter((p) => p.id !== 50);
  const targets = inferLegacyTargets(linked, [9]);
  assert.deepStrictEqual(targets, { cycle_ids: [9], plant_ids: [] });

  const ids = resolveTaskPlants(targets, [], cycle9).map((p) => p.id).sort((a, b) => a - b);
  assert.deepStrictEqual(ids, [29, 39, 41, 50]);
});

test('tarea vieja de un ciclo entero: la planta que se fue a otro ciclo ya no cuenta', () => {
  const linked: TargetPlant[] = [
    { id: 50, cycle_id: 9 },
    { id: 56, cycle_id: 13 },
    { id: 57, cycle_id: 13 },
  ];
  assert.deepStrictEqual(inferLegacyTargets(linked, [13]), { cycle_ids: [13], plant_ids: [] });
});

test('tarea vieja de una planta suelta: no se extiende a todo su ciclo', () => {
  const targets = inferLegacyTargets([{ id: 55, cycle_id: 14 }], [14]);
  assert.deepStrictEqual(targets, { cycle_ids: [], plant_ids: [55] });

  const plants = resolveTaskPlants(targets, [{ id: 55, cycle_id: 14 }], []);
  assert.deepStrictEqual(plants.map((p) => p.id), [55]);
});

test('tarea vieja sin ciclos usa las plantas enlazadas', () => {
  assert.deepStrictEqual(inferLegacyTargets([{ id: 7, cycle_id: null }], []), { cycle_ids: [], plant_ids: [7] });
});

test('resolveTaskPlants junta plantas sueltas y ciclos sin repetir', () => {
  const plants = resolveTaskPlants(
    { cycle_ids: [9], plant_ids: [29, 70] },
    [{ id: 29, cycle_id: 9 }, { id: 70, cycle_id: 12 }],
    cycle9
  );
  assert.deepStrictEqual(plants.map((p) => p.id).sort((a, b) => a - b), [29, 39, 41, 50, 70]);
});
