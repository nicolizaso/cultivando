import { test } from 'node:test';
import assert from 'node:assert';
import { climateByStage, climateSeries, dominantStage, stageClimate, stageOnDay, stagePeriods, vpd, vpdLevel } from './climate.ts';

test('vpd - valores conocidos', () => {
  // 25 °C y 60 % → ~1,27 kPa.
  assert.ok(Math.abs((vpd(25, 60) ?? 0) - 1.267) < 0.01);
  assert.strictEqual(vpd(25, 100), 0);
});

test('vpd - sin datos o con datos imposibles da null', () => {
  assert.strictEqual(vpd(null, 60), null);
  assert.strictEqual(vpd(25, undefined), null);
  assert.strictEqual(vpd(25, 140), null);
});

test('vpdLevel - bajo, en rango y alto', () => {
  assert.strictEqual(vpdLevel(0.3), 'low');
  assert.strictEqual(vpdLevel(1.0), 'ok');
  assert.strictEqual(vpdLevel(1.8), 'high');
  assert.strictEqual(vpdLevel(null), 'unknown');
});

test('stageClimate - rango por etapa, nada en el curado', () => {
  assert.deepStrictEqual(stageClimate('Floración')?.vpd, { min: 1.2, max: 1.6 });
  assert.strictEqual(stageClimate('Curado'), null);
  assert.strictEqual(stageClimate('Inventada'), null);
});

test('dominantStage - la mayoría de las activas, empate a la más avanzada', () => {
  assert.strictEqual(dominantStage([{ stage: 'Vegetativo' }, { stage: 'Vegetativo' }, { stage: 'Floración' }]), 'Vegetativo');
  assert.strictEqual(dominantStage([{ stage: 'Vegetativo' }, { stage: 'Floración' }]), 'Floración');
  assert.strictEqual(dominantStage([{ stage: 'Floración', is_archived: true }, { stage: 'Vegetativo' }]), 'Vegetativo');
  assert.strictEqual(dominantStage([]), null);
});

test('climateSeries - un punto por día, promediado y ordenado', () => {
  const series = climateSeries([
    { date: '2026-10-02', temperature: 24, humidity: 60 },
    { date: '2026-10-01', temperature: 22, humidity: 70 },
    { date: '2026-10-02', temperature: 26, humidity: 50 },
    { date: null, temperature: 20, humidity: 50 },
  ]);
  assert.deepStrictEqual(series.map((p) => p.day), ['2026-10-01', '2026-10-02']);
  assert.strictEqual(series[1].temperature, 25);
  assert.strictEqual(series[1].humidity, 55);
  assert.strictEqual(series[1].count, 2);
  // El VPD se promedia por medición, no se calcula con los promedios.
  const expected = ((vpd(24, 60) ?? 0) + (vpd(26, 50) ?? 0)) / 2;
  assert.ok(Math.abs((series[1].vpd ?? 0) - expected) < 1e-9);
});

test('climateSeries - una humedad vacía no rompe el día', () => {
  const [point] = climateSeries([{ date: '2026-10-01', temperature: 24, humidity: null }]);
  assert.strictEqual(point.temperature, 24);
  assert.strictEqual(point.humidity, null);
  assert.strictEqual(point.vpd, null);
});

test('stagePeriods y stageOnDay - etapas del ciclo por la primera planta que entró', () => {
  const periods = stagePeriods([
    { date_germinacion: '2026-08-01T12:00:00Z', date_vegetativo: '2026-08-20T12:00:00Z' },
    { date_germinacion: '2026-08-03T12:00:00Z', date_vegetativo: '2026-08-18T12:00:00Z', date_floracion: '2026-09-20T12:00:00Z' },
  ]);
  assert.deepStrictEqual(periods, [
    { stage: 'Germinación', from: '2026-08-01', to: '2026-08-18' },
    { stage: 'Vegetativo', from: '2026-08-18', to: '2026-09-20' },
    { stage: 'Floración', from: '2026-09-20', to: null },
  ]);
  assert.strictEqual(stageOnDay('2026-07-30', periods), null);
  assert.strictEqual(stageOnDay('2026-08-18', periods), 'Vegetativo');
  assert.strictEqual(stageOnDay('2026-10-17', periods), 'Floración');
});

test('climateByStage - promedio y días en rango de cada etapa', () => {
  const periods = [
    { stage: 'Vegetativo' as const, from: '2026-09-01', to: '2026-09-10' },
    { stage: 'Floración' as const, from: '2026-09-10', to: null },
  ];
  const points = [
    { day: '2026-09-02', temperature: 25, humidity: 60, vpd: 1.0, count: 1 },
    { day: '2026-09-03', temperature: 25, humidity: 60, vpd: 1.5, count: 1 },
    { day: '2026-09-12', temperature: 24, humidity: 45, vpd: 1.4, count: 1 },
  ];
  const stats = climateByStage(points, periods);
  assert.strictEqual(stats.length, 2);
  assert.strictEqual(stats[0].stage, 'Vegetativo');
  assert.strictEqual(stats[0].days, 2);
  assert.strictEqual(stats[0].avgVpd, 1.25);
  assert.strictEqual(stats[0].inRange, 0.5);
  assert.strictEqual(stats[1].inRange, 1);
});

test('climateByStage - etapas sin mediciones no aparecen', () => {
  const stats = climateByStage([], [{ stage: 'Vegetativo', from: '2026-09-01', to: null }]);
  assert.deepStrictEqual(stats, []);
});
