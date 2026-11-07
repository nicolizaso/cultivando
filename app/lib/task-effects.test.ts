import { test } from 'node:test';
import assert from 'node:assert';
import {
  completionNeeds,
  cycleMoveEntry,
  cycleMoveTitle,
  getCompletionPlan,
  getTaskEffectDate,
  HARVEST_STAGE,
  isOverdue,
  logTitleFor,
  stageLogTitle,
  inferLegacyTargets,
  planAmbienteMove,
  readTaskTargets,
  resolveTaskPlants,
  shouldApplyStage,
  taskAppliesToPlant,
} from './task-effects.ts';
import type { StageEffect, TargetPlant } from './task-effects.ts';

const base = { water: false, stage: null, archive: false, harvest: false, move: false, feed: false };

test('riego y lavado marcan el riego', () => {
  assert.deepStrictEqual(getCompletionPlan({ type: 'riego' }), { ...base, logType: 'riego', water: true });
  assert.deepStrictEqual(getCompletionPlan({ type: 'lavado' }), { ...base, logType: 'lavado', water: true });
});

test('fertilizante: anota la mezcla y cuenta como riego sólo si va en el agua', () => {
  assert.deepStrictEqual(getCompletionPlan({ type: 'fertilizante', application_type: 'Riego' }), {
    ...base, logType: 'fertilizante', water: true, feed: true,
  });
  assert.deepStrictEqual(getCompletionPlan({ type: 'fertilizante', application_type: 'Foliar' }), {
    ...base, logType: 'fertilizante', feed: true,
  });
});

test('cambio_etapa usa la etapa elegida en la tarea', () => {
  assert.deepStrictEqual(getCompletionPlan({ type: 'cambio_etapa', target_stage: 'Floración' }), {
    ...base, logType: 'cambio_etapa', stage: { kind: 'stage', stage: 'Floración', onlyForward: false },
  });
});

test('cambio_etapa con una etapa inexistente no cambia la etapa', () => {
  assert.strictEqual(getCompletionPlan({ type: 'cambio_etapa', target_stage: 'stage; drop' })?.stage, null);
  assert.strictEqual(getCompletionPlan({ type: 'cambio_etapa', target_stage: null })?.stage, null);
});

test('cosechar pasa a secado sin retroceder y crea la ficha de cosecha', () => {
  assert.deepStrictEqual(getCompletionPlan({ type: 'cosechar' }), {
    ...base, logType: 'cosechar', harvest: true, stage: { kind: 'stage', stage: HARVEST_STAGE, onlyForward: true },
  });
  assert.strictEqual(HARVEST_STAGE, 'Secado');
});

test('declarar muerta archiva y cambiar ambiente muda', () => {
  assert.deepStrictEqual(getCompletionPlan({ type: 'muerta' }), { ...base, logType: 'muerta', archive: true });
  assert.deepStrictEqual(getCompletionPlan({ type: 'ambiente' }), { ...base, logType: 'ambiente', move: true });
});

test('los tipos sin cambio igual dejan su registro', () => {
  for (const type of ['poda', 'trasplante', 'entrenamiento', 'repelente', 'otro']) {
    assert.deepStrictEqual(getCompletionPlan({ type }), { ...base, logType: type }, `tipo ${type}`);
  }
  assert.deepStrictEqual(getCompletionPlan({ type: 'algo viejo' }), { ...base, logType: 'otro' });
});

test('cycleMoveEntry: el registro de una mudanza, igual a mano o por tarea', () => {
  assert.deepStrictEqual(cycleMoveEntry('Indoor 1x1', 'Indoor Vege'), {
    type: 'ambiente',
    title: 'Mudanza de espacio: Indoor 1x1 → Indoor Vege',
    notes: 'El ciclo pasó de "Indoor 1x1" a "Indoor Vege".',
  });
});

test('el esquejado se completa por su lado', () => {
  assert.strictEqual(getCompletionPlan({ type: 'esquejado' }), null);
});

test('logTitleFor: el título del registro de cada tipo', () => {
  assert.strictEqual(logTitleFor('riego', 'Riego'), 'Riego');
  assert.strictEqual(logTitleFor('lavado', 'Lavado de raíces'), 'Lavado de raíces');
  assert.strictEqual(logTitleFor('cosechar', 'Cosechar'), 'Cosecha');
  assert.strictEqual(logTitleFor('muerta', 'Declarar muerta'), 'Declarada muerta');
  assert.strictEqual(logTitleFor('cambio_etapa', 'Cambio de etapa', 'Secado'), 'Cambio de etapa a Secado');
  assert.strictEqual(logTitleFor('otro', 'Revisar tricomas'), 'Revisar tricomas');
  assert.strictEqual(stageLogTitle('Floración'), 'Cambio de etapa a Floración');
  assert.strictEqual(cycleMoveTitle('Indoor Vege', 'Indoor 1x1'), 'Mudanza de espacio: Indoor Vege → Indoor 1x1');
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

// 7 de noviembre, 18:00 en Argentina.
const NOW = new Date('2026-11-07T21:00:00.000Z');

test('getTaskEffectDate: sin día o con el de hoy, ahora', () => {
  assert.strictEqual(getTaskEffectDate(undefined, NOW), NOW.toISOString());
  assert.strictEqual(getTaskEffectDate(null, NOW), NOW.toISOString());
  assert.strictEqual(getTaskEffectDate('2026-11-07', NOW), NOW.toISOString());
});

test('getTaskEffectDate: un día pasado queda al mediodía de ese día', () => {
  assert.strictEqual(getTaskEffectDate('2026-11-01', NOW), '2026-11-01T15:00:00.000Z');
});

test('getTaskEffectDate: nunca en el futuro ni con basura', () => {
  assert.strictEqual(getTaskEffectDate('2026-11-08', NOW), NOW.toISOString());
  assert.strictEqual(getTaskEffectDate('cualquier cosa', NOW), NOW.toISOString());
});

test('isOverdue: sólo si el día agendado ya pasó, en hora argentina', () => {
  assert.strictEqual(isOverdue('2026-11-06T12:00:00+00:00', NOW), true);
  assert.strictEqual(isOverdue('2026-11-07T12:00:00+00:00', NOW), false);
  // 23:30 del 6 en Argentina: ya es atrasada.
  assert.strictEqual(isOverdue('2026-11-07T02:30:00+00:00', NOW), true);
  assert.strictEqual(isOverdue('2026-11-09T12:00:00+00:00', NOW), false);
  assert.strictEqual(isOverdue(null, NOW), false);
});

const today = '2026-11-07T12:00:00+00:00';

test('completionNeeds: lo de hoy sin nada que preguntar se completa de un toque', () => {
  const needs = completionNeeds({ type: 'riego', due_date: today }, false, NOW);
  assert.deepStrictEqual(needs, { date: false, feed: false, harvest: false, ambiente: false, confirm: null, any: false });
});

test('completionNeeds: una atrasada pregunta el día', () => {
  const needs = completionNeeds({ type: 'riego', due_date: '2026-11-03T12:00:00+00:00' }, false, NOW);
  assert.strictEqual(needs.date, true);
  assert.strictEqual(needs.any, true);
});

test('completionNeeds: mezcla, cosecha, mudanza y muerta preguntan lo suyo', () => {
  assert.strictEqual(completionNeeds({ type: 'fertilizante', due_date: today }, true, NOW).feed, true);
  assert.strictEqual(completionNeeds({ type: 'fertilizante', due_date: today }, false, NOW).any, false);
  assert.strictEqual(completionNeeds({ type: 'cosechar', due_date: today }, false, NOW).harvest, true);
  const ambiente = completionNeeds({ type: 'ambiente', due_date: today, target_space_id: 3 }, false, NOW);
  assert.strictEqual(ambiente.ambiente, true);
  assert.strictEqual(ambiente.confirm, 'ambiente');
  assert.strictEqual(completionNeeds({ type: 'muerta', due_date: today }, false, NOW).confirm, 'muerta');
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

// Espacio 1: ciclos 9 y 13. Espacio 2 (destino): ciclo 20, el único activo.
const spaces = new Map<number, number | null>([[9, 1], [13, 1], [20, 2]]);
// Plantas activas de cada ciclo hoy.
const active = new Map<number, number[]>([[9, [29, 39, 41, 50]], [13, [56, 57]], [20, [70]]]);

test('ambiente: un ciclo elegido entero se muda', () => {
  const plan = planAmbienteMove({ cycle_ids: [9], plant_ids: [] }, 2, [], spaces, [20], active);
  assert.deepStrictEqual(plan, { cycleIds: [9], plantIds: [], targetCycleId: 20, unplacedPlantIds: [] });
});

test('ambiente: una planta sola no muda su ciclo, pasa al ciclo activo del destino', () => {
  // Tarea vieja de una planta: el ciclo se enlazó sólo por ser el de la planta.
  const targets = inferLegacyTargets([{ id: 29, cycle_id: 9 }], [9]);
  const plan = planAmbienteMove(targets, 2, [{ id: 29, cycle_id: 9 }], spaces, [20], active);
  assert.deepStrictEqual(plan, { cycleIds: [], plantIds: [29], targetCycleId: 20, unplacedPlantIds: [] });
});

test('ambiente: sin un único ciclo activo en el destino, la planta queda pendiente', () => {
  const targets = { cycle_ids: [], plant_ids: [29] };
  const plants = [{ id: 29, cycle_id: 9 }];
  assert.deepStrictEqual(planAmbienteMove(targets, 2, plants, spaces, [], active).unplacedPlantIds, [29]);
  assert.deepStrictEqual(planAmbienteMove(targets, 2, plants, spaces, [20, 21], active).unplacedPlantIds, [29]);
  assert.deepStrictEqual(planAmbienteMove(targets, 2, plants, spaces, [20, 21], active).plantIds, []);
});

test('ambiente: no se mueve lo que ya está en el destino ni lo que viaja con su ciclo', () => {
  const plan = planAmbienteMove(
    { cycle_ids: [9, 20], plant_ids: [29, 70, 80] },
    2,
    [
      { id: 29, cycle_id: 9 }, // viaja con el ciclo 9
      { id: 70, cycle_id: 20 }, // ya está en el espacio 2
      { id: 80, cycle_id: 13, is_archived: true }, // archivada
    ],
    spaces,
    [20],
    active
  );
  assert.deepStrictEqual(plan, { cycleIds: [9], plantIds: [], targetCycleId: 20, unplacedPlantIds: [] });
});

test('ambiente: una planta sin ciclo también pasa al ciclo del destino', () => {
  const plan = planAmbienteMove({ cycle_ids: [], plant_ids: [7] }, 2, [{ id: 7, cycle_id: null }], spaces, [20], active);
  assert.deepStrictEqual(plan.plantIds, [7]);
});

test('ambiente: si se eligen todas las plantas activas de un ciclo, se muda el ciclo', () => {
  // El caso de la planta 56: la única activa del ciclo 13, a un espacio sin ciclos.
  const spacesNow = new Map<number, number | null>([[13, 8]]);
  const plan = planAmbienteMove(
    { cycle_ids: [], plant_ids: [56] },
    9,
    [{ id: 56, cycle_id: 13 }],
    spacesNow,
    [],
    new Map([[13, [56]]])
  );
  assert.deepStrictEqual(plan, { cycleIds: [13], plantIds: [], targetCycleId: null, unplacedPlantIds: [] });
});

test('ambiente: una archivada en el ciclo no impide mudarlo entero', () => {
  const plan = planAmbienteMove(
    { cycle_ids: [], plant_ids: [56, 57] },
    2,
    [{ id: 56, cycle_id: 13 }, { id: 57, cycle_id: 13 }, { id: 58, cycle_id: 13, is_archived: true }],
    spaces,
    [],
    active
  );
  assert.deepStrictEqual(plan.cycleIds, [13]);
  assert.deepStrictEqual(plan.unplacedPlantIds, []);
});

test('ambiente: con una sola de dos plantas activas, la planta no arrastra al ciclo', () => {
  const plan = planAmbienteMove({ cycle_ids: [], plant_ids: [56] }, 2, [{ id: 56, cycle_id: 13 }], spaces, [], active);
  assert.deepStrictEqual(plan, { cycleIds: [], plantIds: [], targetCycleId: null, unplacedPlantIds: [56] });
});

test('ambiente: el ciclo elegido al completar recibe a las plantas sueltas', () => {
  const plants = [{ id: 29, cycle_id: 9 }];
  const chosen = planAmbienteMove({ cycle_ids: [], plant_ids: [29] }, 2, plants, spaces, [20, 21], active, 21);
  assert.deepStrictEqual(chosen, { cycleIds: [], plantIds: [29], targetCycleId: 21, unplacedPlantIds: [] });
  // Un ciclo que no está activo en el destino no vale.
  const wrong = planAmbienteMove({ cycle_ids: [], plant_ids: [29] }, 2, plants, spaces, [20, 21], active, 13);
  assert.deepStrictEqual(wrong.unplacedPlantIds, [29]);
});

test('taskAppliesToPlant - ciclo entero alcanza a las plantas que están hoy', () => {
  const task = { metadata: { targets: { cycle_ids: [10], plant_ids: [] } }, task_plants: [{ plant_id: 1 }] };
  assert.strictEqual(taskAppliesToPlant(task, { id: 1, cycle_id: 10 }), true);
  assert.strictEqual(taskAppliesToPlant(task, { id: 2, cycle_id: 10 }), true, 'entró después de agendarla');
  assert.strictEqual(taskAppliesToPlant(task, { id: 1, cycle_id: 11 }), false, 'se fue a otro ciclo');
});

test('taskAppliesToPlant - una planta suelta no arrastra al resto de su ciclo', () => {
  const task = { metadata: { targets: { cycle_ids: [], plant_ids: [5] } }, task_plants: [{ plant_id: 5 }] };
  assert.strictEqual(taskAppliesToPlant(task, { id: 5, cycle_id: 10 }), true);
  assert.strictEqual(taskAppliesToPlant(task, { id: 6, cycle_id: 10 }), false);
});

test('taskAppliesToPlant - tareas viejas: por task_plants', () => {
  const task = { metadata: null, task_plants: [{ plant_id: 7 }] };
  assert.strictEqual(taskAppliesToPlant(task, { id: 7, cycle_id: 1 }), true);
  assert.strictEqual(taskAppliesToPlant(task, { id: 8, cycle_id: 1 }), false);
});
