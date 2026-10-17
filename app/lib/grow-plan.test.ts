import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGrowPlan, countByType } from './grow-plan.ts';
import type { GrowPlanOptions } from './grow-plan.ts';

const base: GrowPlanOptions = {
  today: '2026-10-17',
  currentStage: 'Vegetativo',
  stageStart: '2026-10-10',
  vegDays: 28,
  flowerDays: 56,
  waterEvery: 3,
  feedEvery: 2,
  flushDays: 10,
  vegNutrition: { type: 'product', id: 1 },
  flowerNutrition: { type: 'combo', id: 9 },
  include: { stageChange: true, harvest: true, flush: true },
};

test('buildGrowPlan - fechas de etapas y cosecha', () => {
  const plan = buildGrowPlan(base)!;
  assert.equal(plan.vegStart, '2026-10-10');
  assert.equal(plan.flowerStart, '2026-11-07');
  assert.equal(plan.harvestDay, '2027-01-02');
  assert.equal(plan.truncated, false);
});

test('buildGrowPlan - riegos cada 3 días, uno de cada 2 con fertilizante de su etapa', () => {
  const plan = buildGrowPlan(base)!;
  const waterings = plan.items.filter((i) => i.type === 'riego' || i.type === 'fertilizante');
  assert.equal(waterings[0].day, '2026-10-18');
  assert.equal(waterings[1].day, '2026-10-21');
  assert.equal(waterings[0].type, 'fertilizante');
  assert.equal(waterings[1].type, 'riego');
  assert.deepEqual(waterings[0].nutrition, { type: 'product', id: 1 });
  assert.equal(waterings[0].week, 2, 'el 18/10 es la semana 2 del vegetativo que empezó el 10');
  const firstFlowerFeed = plan.items.find((i) => i.type === 'fertilizante' && i.stage === 'Floración')!;
  assert.deepEqual(firstFlowerFeed.nutrition, { type: 'combo', id: 9 });
  assert.equal(firstFlowerFeed.week, 1);
});

test('buildGrowPlan - lavado: sin fertilizante los últimos días y una tarea de lavado', () => {
  const plan = buildGrowPlan(base)!;
  const flushStart = '2026-12-23';
  assert.ok(plan.items.some((i) => i.type === 'lavado' && i.day === flushStart));
  assert.ok(!plan.items.some((i) => i.type === 'fertilizante' && i.day >= flushStart));
  assert.ok(plan.items.some((i) => i.type === 'riego' && i.day >= flushStart));
});

test('buildGrowPlan - cambio a floración y cosecha', () => {
  const plan = buildGrowPlan(base)!;
  const counts = countByType(plan.items);
  assert.equal(counts.cambio_etapa, 1);
  assert.equal(counts.cosechar, 1);
  assert.equal(plan.items.at(-1)?.type, 'cosechar');
  assert.equal(plan.items.find((i) => i.type === 'cambio_etapa')?.targetStage, 'Floración');
});

test('buildGrowPlan - desde una etapa previa agrega el pase a vegetativo', () => {
  const plan = buildGrowPlan({ ...base, currentStage: 'Enraizamiento', stageStart: '2026-10-15' })!;
  assert.equal(plan.vegStart, '2026-10-27');
  const changes = plan.items.filter((i) => i.type === 'cambio_etapa').map((i) => i.targetStage);
  assert.deepEqual(changes, ['Vegetativo', 'Floración']);
  // Los esquejes no se fertilizan antes de vegetativo.
  assert.ok(!plan.items.some((i) => i.type === 'fertilizante' && i.stage === 'Previa'));
});

test('buildGrowPlan - en floración no repite el cambio de etapa; secado no tiene plan', () => {
  const plan = buildGrowPlan({ ...base, currentStage: 'Floración', stageStart: '2026-10-01' })!;
  assert.equal(plan.harvestDay, '2026-11-26');
  assert.equal(countByType(plan.items).cambio_etapa, 0);
  assert.equal(buildGrowPlan({ ...base, currentStage: 'Secado' }), null);
});

test('buildGrowPlan - opciones apagadas y sin productos', () => {
  const plan = buildGrowPlan({ ...base, feedEvery: 0, include: { stageChange: false, harvest: false, flush: false } })!;
  const counts = countByType(plan.items);
  assert.equal(counts.fertilizante, 0);
  assert.equal(counts.cambio_etapa + counts.lavado + counts.cosechar, 0);
});

test('buildGrowPlan - tope de tareas', () => {
  const plan = buildGrowPlan({ ...base, waterEvery: 1, vegDays: 200, flowerDays: 100 })!;
  assert.equal(plan.items.length, 200);
  assert.equal(plan.truncated, true);
});
