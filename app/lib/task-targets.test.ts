import { test } from 'node:test';
import assert from 'node:assert';
import { buildTaskTargetOptions, feedContext, targetWeekRef } from './task-targets.ts';

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
    {
      id: 1, name: 'Ciclo A', space_id: 3, days_in_stage: 11, stage: 'Floración',
      timeline: { stage: 'Floración', stageStart: '2026-10-03', vegStart: null, flowerStart: '2026-10-03', flowerPlanned: false, dryStart: null, targetWeeks: 8 },
    },
    {
      id: 2, name: 'Vacío', space_id: undefined, days_in_stage: null, stage: null,
      timeline: { stage: null, stageStart: null, vegStart: null, flowerStart: null, flowerPlanned: false, dryStart: null, targetWeeks: 8 },
    },
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

test('targetWeekRef - cuenta desde los días de la dosis y usa el pase previsto del ciclo', () => {
  const timeline = { stage: 'Vegetativo' as const, stageStart: '2026-10-01', vegStart: '2026-10-01', flowerStart: '2026-12-01', flowerPlanned: true, dryStart: null, targetWeeks: 8 };
  const cycles = [{ id: 1, name: 'A', space_id: 5, days_in_stage: 20, stage: 'Vegetativo', timeline }];
  const plants = [{ id: '10', name: 'A1', cycle_id: 1, days_in_stage: 20, stage: 'Vegetativo' }];

  const { ref, reason } = targetWeekRef([{ id: '10', type: 'plant' }], plants, cycles, '2026-11-19');
  assert.equal(reason, null);
  assert.equal(ref?.vegStart, '2026-10-30');
  assert.equal(ref?.flowerStart, '2026-12-01');
  assert.equal(ref?.flowerPlanned, true);
});

test('targetWeekRef - sin objetivo, sin fechas o con ciclos de fechas distintas no hay cuenta', () => {
  const a = { stage: 'Floración' as const, stageStart: '2026-11-01', vegStart: null, flowerStart: '2026-11-01', flowerPlanned: false, dryStart: null, targetWeeks: 8 };
  const b = { ...a, flowerStart: '2026-11-08', stageStart: '2026-11-08' };
  const empty = { ...a, stage: null, stageStart: null, flowerStart: null };
  const cycles = [
    { id: 1, name: 'A', space_id: 5, days_in_stage: 18, stage: 'Floración', timeline: a },
    { id: 2, name: 'B', space_id: 5, days_in_stage: 11, stage: 'Floración', timeline: b },
    { id: 3, name: 'C', space_id: 6, days_in_stage: null, stage: null, timeline: empty },
  ];
  assert.equal(targetWeekRef([], [], cycles, '2026-11-19').ref, null);
  assert.match(targetWeekRef([{ id: 5, type: 'space' }], [], cycles, '2026-11-19').reason ?? '', /fechas distintas/);
  assert.match(targetWeekRef([{ id: 3, type: 'cycle' }], [], cycles, '2026-11-19').reason ?? '', /Cargá la etapa/);
  assert.equal(targetWeekRef([{ id: 1, type: 'cycle' }], [], cycles, '2026-11-19').ref?.flowerStart, '2026-11-01');
});
