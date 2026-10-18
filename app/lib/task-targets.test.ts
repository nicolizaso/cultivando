import { test } from 'node:test';
import assert from 'node:assert';
import { buildTaskTargetOptions } from './task-targets.ts';

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

  assert.deepStrictEqual(plants.map((p) => [p.id, p.days_in_stage, p.cycle_id]), [['10', 7, 1], ['11', 14, 1]]);
  assert.deepStrictEqual(cycles, [
    { id: 1, name: 'Ciclo A', space_id: 3, days_in_stage: 11 },
    { id: 2, name: 'Vacío', space_id: undefined, days_in_stage: null },
  ]);
});
