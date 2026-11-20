import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cycleTimeline, cycleWeekRef, dayForStageWeek, stageWeekOn, timelineText, weekLabel } from './cycle-week.ts';

const flowering = [
  { stage: 'Floración', date_vegetativo: '2026-09-01', date_floracion: '2026-10-26' },
  { stage: 'Floración', date_vegetativo: '2026-09-01', date_floracion: '2026-10-27' },
];

test('cycleWeekRef - etapa dominante, inicio real más temprano y meta por defecto', () => {
  const ref = cycleWeekRef(flowering, {});
  assert.equal(ref.stage, 'Floración');
  assert.equal(ref.stageStart, '2026-10-26');
  assert.equal(ref.vegStart, '2026-09-01');
  assert.equal(ref.flowerStart, '2026-10-26');
  assert.equal(ref.flowerPlanned, false);
  assert.equal(ref.targetWeeks, 8);
});

test('cycleWeekRef - el pase real gana al previsto, aunque sea de una sola planta', () => {
  const plants = [
    { stage: 'Vegetativo', date_vegetativo: '2026-10-01' },
    { stage: 'Vegetativo', date_vegetativo: '2026-10-01' },
    { stage: 'Floración', date_vegetativo: '2026-10-01', date_floracion: '2026-11-10' },
  ];
  const ref = cycleWeekRef(plants, { planned_flower_start: '2026-11-20', flower_target_weeks: 9 });
  assert.equal(ref.stage, 'Vegetativo');
  assert.equal(ref.flowerStart, '2026-11-10');
  assert.equal(ref.flowerPlanned, false);
  assert.equal(ref.targetWeeks, 9);
});

test('cycleWeekRef - en vege usa el pase previsto y la meta fuera de rango se acota', () => {
  const ref = cycleWeekRef([{ stage: 'Vegetativo', date_vegetativo: '2026-11-01' }], { planned_flower_start: '2026-12-01', flower_target_weeks: 99 });
  assert.equal(ref.flowerStart, '2026-12-01');
  assert.equal(ref.flowerPlanned, true);
  assert.equal(ref.targetWeeks, 30);
});

test('cycleTimeline - semana 1 el día del pase, semana 2 el día 7', () => {
  const ref = cycleWeekRef(flowering, {});
  assert.deepEqual([cycleTimeline(ref, '2026-10-26').week, cycleTimeline(ref, '2026-10-26').dayInStage], [1, 0]);
  assert.deepEqual([cycleTimeline(ref, '2026-11-01').week, cycleTimeline(ref, '2026-11-02').week], [1, 2]);
});

test('cycleTimeline - cosecha aproximada con la meta y semanas que faltan', () => {
  const ref = cycleWeekRef(flowering, {});
  const t = cycleTimeline(ref, '2026-11-19');
  assert.equal(t.week, 4);
  assert.equal(t.dayInStage, 24);
  assert.equal(t.harvestApprox, '2026-12-21');
  assert.equal(t.weeksLeft, 5);
  assert.equal(t.overTarget, 0);
});

test('cycleTimeline - meta superada se cuenta en semanas de más', () => {
  const ref = cycleWeekRef(flowering, { flower_target_weeks: 8 });
  const t = cycleTimeline(ref, '2026-12-24');
  assert.equal(t.week, 9);
  assert.equal(t.overTarget, 1);
  assert.equal(t.weeksLeft, 0);
});

test('cycleTimeline - vege con pase previsto: semana de vege y cosecha desde el previsto', () => {
  const ref = cycleWeekRef([{ stage: 'Vegetativo', date_vegetativo: '2026-11-01' }], { planned_flower_start: '2026-12-01' });
  const t = cycleTimeline(ref, '2026-11-19');
  assert.equal(t.stage, 'Vegetativo');
  assert.equal(t.week, 3);
  assert.equal(t.harvestApprox, '2027-01-26');
});

test('cycleTimeline - sin fechas ni etapa conocida no hay semana', () => {
  const t = cycleTimeline(cycleWeekRef([{ stage: null }], {}), '2026-11-19');
  assert.equal(t.week, null);
  assert.equal(t.harvestApprox, null);
});

test('cycleTimeline - etapas previas y secado: día en etapa, sin semana', () => {
  const t = cycleTimeline(cycleWeekRef([{ stage: 'Plántula', date_plantula: '2026-11-15' }], {}), '2026-11-19');
  assert.equal(t.stage, 'Plántula');
  assert.equal(t.week, null);
  assert.equal(t.dayInStage, 4);
  const dry = cycleTimeline(cycleWeekRef([{ stage: 'Secado', date_floracion: '2026-09-01', date_secado: '2026-11-10' }], {}), '2026-11-19');
  assert.equal(dry.week, null);
  assert.equal(dry.dayInStage, 9);
  assert.equal(dry.harvestApprox, null);
});

test('stageWeekOn y weekLabel - rotulan vege y flora, con el previsto marcado', () => {
  const ref = cycleWeekRef([{ stage: 'Vegetativo', date_vegetativo: '2026-11-01' }], { planned_flower_start: '2026-12-01' });
  assert.equal(stageWeekOn('2026-10-31', ref), null);
  assert.deepEqual(stageWeekOn('2026-11-08', ref), { stage: 'Vegetativo', week: 2, dayInStage: 7, planned: false });
  assert.deepEqual(weekLabel('2026-12-15', ref), { short: 'F3', long: 'Flora · semana 3 · día 14', planned: true });
});

test('stageWeekOn - después del secado no hay semana de flora', () => {
  const ref = cycleWeekRef([{ stage: 'Secado', date_floracion: '2026-09-01', date_secado: '2026-11-10' }], {});
  assert.equal(stageWeekOn('2026-11-01', ref)?.week, 9);
  assert.equal(stageWeekOn('2026-11-12', ref), null);
});

test('dayForStageWeek - semana y día de etapa a fecha, null sin inicio', () => {
  const ref = cycleWeekRef(flowering, {});
  assert.equal(dayForStageWeek('Floración', 1, 1, ref), '2026-10-26');
  assert.equal(dayForStageWeek('Floración', 6, 1, ref), '2026-11-30');
  assert.equal(dayForStageWeek('Floración', 6, 3, ref), '2026-12-02');
  assert.equal(dayForStageWeek('Vegetativo', 2, 1, ref), '2026-09-08');
  const noFlower = cycleWeekRef([{ stage: 'Vegetativo', date_vegetativo: '2026-11-01' }], {});
  assert.equal(dayForStageWeek('Floración', 2, 1, noFlower), null);
});

test('timelineText - flora con meta, meta superada, vege con pase previsto y sin etapa', () => {
  const ref = cycleWeekRef(flowering, {});
  const t = timelineText(cycleTimeline(ref, '2026-11-19'), '2026-11-19');
  assert.equal(t.headline, 'Flora · semana 4 de ~8');
  assert.equal(t.detail, 'día 24 · cosecha aprox. 21 dic');
  assert.equal(t.progress, 24 / 56);

  const over = timelineText(cycleTimeline(ref, '2026-12-24'), '2026-12-24');
  assert.equal(over.headline, 'Flora · semana 9');
  assert.equal(over.detail, 'día 59 · 1 semana más que lo previsto');
  assert.equal(over.progress, 1);

  const vegRef = cycleWeekRef([{ stage: 'Vegetativo', date_vegetativo: '2026-11-01' }], { planned_flower_start: '2026-12-01' });
  const veg = timelineText(cycleTimeline(vegRef, '2026-11-19'), '2026-11-19');
  assert.equal(veg.headline, 'Vege · semana 3');
  assert.equal(veg.detail, 'día 18 · flora aprox. 1 dic');

  assert.equal(timelineText(cycleTimeline(cycleWeekRef([], {}), '2026-11-19'), '2026-11-19').headline, 'Sin etapa cargada');
});
