import { test } from 'node:test';
import assert from 'node:assert';
import { buildTaskTargetOptions, feedContext } from './task-targets.ts';

const now = new Date('2026-10-17T15:00:00Z');

test('buildTaskTargetOptions - días en etapa por planta y promedio por ciclo, sin archivadas', () => {
  const { plants, cycles } = buildTaskTargetOptions(
    [
      {
        id: 1,
        name: 'Ciclo A',
        space_id: 3,
        plants: [
          { id: 10, name: 'A1', stage: 'Floración', date_floracion: '2026-10-10T15:00:00Z' },
          { id: 11, name: 'A2', stage: 'Floración', date_floracion: '2026-10-03T15:00:00Z' },
          { id: 12, name: 'Muerta', stage: 'Floración', date_floracion: '2026-09-01T15:00:00Z', is_archived: true },
        ],
      },
      { id: 2, name: 'Vacío', space_id: null, plants: [] },
    ],
    now
  );

  assert.deepStrictEqual(plants.map((p) => [p.id, p.days_in_stage, p.cycle_id, p.stage]), [['10', 7, 1, 'Floración'], ['11', 14, 1, 'Floración']]);
  assert.deepStrictEqual(cycles, [
    { id: 1, name: 'Ciclo A', space_id: 3, days_in_stage: 11, stage: 'Floración' },
    { id: 2, name: 'Vacío', space_id: undefined, days_in_stage: null, stage: null },
  ]);
});

test('feedContext - usa la semana más temprana y junta las etapas', () => {
  const plants = [
    { id: '10', name: 'A1', cycle_id: 1, days_in_stage: 20, stage: 'Floración' },
    { id: '20', name: 'B1', cycle_id: 2, days_in_stage: 3, stage: 'Vegetativo' },
  ];
  const cycles = [
    { id: 1, name: 'A', space_id: 5, days_in_stage: 20, stage: 'Floración' },
    { id: 2, name: 'B', space_id: 6, days_in_stage: 3, stage: 'Vegetativo' },
  ];
  assert.deepStrictEqual(feedContext([{ id: 1, type: 'cycle' }, { id: '20', type: 'plant' }], plants, cycles), {
    stageDays: 3, minWeek: 1, maxWeek: 3, stages: ['Floración', 'Vegetativo'],
  });
  assert.deepStrictEqual(feedContext([{ id: 5, type: 'space' }], plants, cycles), {
    stageDays: 20, minWeek: 3, maxWeek: 3, stages: ['Floración'],
  });
  assert.deepStrictEqual(feedContext([], plants, cycles), { stageDays: null, minWeek: null, maxWeek: null, stages: [] });
});
