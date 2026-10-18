import { test } from 'node:test';
import assert from 'node:assert';
import { getPlantMetrics } from './plant-metrics.ts';

const now = new Date('2026-10-17T15:00:00Z'); // 12:00 en Argentina

test('getPlantMetrics - la etapa sale de la fecha más avanzada', () => {
  const metrics = getPlantMetrics(
    {
      stage: 'Vegetativo',
      planted_at: '2026-08-01T12:00:00Z',
      date_germinacion: '2026-08-01T12:00:00Z',
      date_vegetativo: '2026-09-01T12:00:00Z',
      date_floracion: '2026-10-10T15:00:00Z',
    },
    now
  );
  assert.strictEqual(metrics.currentStage, 'Floración');
  assert.strictEqual(metrics.daysInCurrentStage, 7);
  assert.strictEqual(metrics.totalAge, 77);
});

test('getPlantMetrics - sin fechas de etapa usa stage y stage_updated_at', () => {
  // Las plantas creadas desde el modal no anotaban la fecha de su etapa y
  // quedaban en "0 días" para siempre.
  const metrics = getPlantMetrics(
    { stage: 'Germinación', planted_at: '2026-10-07T12:00:00Z', stage_updated_at: '2026-10-07T12:00:00Z' },
    now
  );
  assert.strictEqual(metrics.currentStage, 'Germinación');
  assert.strictEqual(metrics.daysInCurrentStage, 10);
  assert.strictEqual(metrics.totalAge, 10);
});

test('getPlantMetrics - cuenta días de Argentina, no de UTC', () => {
  // Cortada el 16 a las 23:00 de Buenos Aires (02:00 UTC del 17): lleva 1 día.
  const metrics = getPlantMetrics({ stage: 'Enraizamiento', date_enraizamiento: '2026-10-17T02:00:00Z' }, now);
  assert.strictEqual(metrics.daysInCurrentStage, 1);
});

test('getPlantMetrics - sin ningún dato no rompe', () => {
  const metrics = getPlantMetrics({}, now);
  assert.deepStrictEqual(metrics, { currentStage: '', stageStartedAt: null, daysInCurrentStage: 0, totalAge: 0 });
});
