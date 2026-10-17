import { test } from 'node:test';
import assert from 'node:assert';
import { buildOccurrenceDates, isFrequency } from './recurrence.ts';

test('buildOccurrenceDates - mensual desde el 31 no se corre', () => {
  // La regresión: 31/1 → 3/3 → 3/4… con setMonth.
  const { dates } = buildOccurrenceDates('2026-01-31', '2026-05-31', 'monthly');
  assert.deepStrictEqual(dates, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
});

test('buildOccurrenceDates - mensual cruza el año y respeta bisiestos', () => {
  const { dates } = buildOccurrenceDates('2027-12-31', '2028-03-01', 'monthly');
  assert.deepStrictEqual(dates, ['2027-12-31', '2028-01-31', '2028-02-29']);
});

test('buildOccurrenceDates - pasos en días', () => {
  assert.deepStrictEqual(buildOccurrenceDates('2026-10-17', '2026-10-21', 'every2days').dates, ['2026-10-17', '2026-10-19', '2026-10-21']);
  assert.deepStrictEqual(buildOccurrenceDates('2026-10-17', '2026-11-01', 'weekly').dates, ['2026-10-17', '2026-10-24', '2026-10-31']);
  assert.deepStrictEqual(buildOccurrenceDates('2026-10-17', '2026-10-31', 'biweekly').dates, ['2026-10-17', '2026-10-31']);
});

test('buildOccurrenceDates - avisa cuando corta por el tope', () => {
  const capped = buildOccurrenceDates('2026-01-01', '2026-12-31', 'daily', 90);
  assert.strictEqual(capped.dates.length, 90);
  assert.strictEqual(capped.truncated, true);
  const justo = buildOccurrenceDates('2026-01-01', '2026-01-03', 'daily', 3);
  assert.strictEqual(justo.truncated, false);
});

test('buildOccurrenceDates - sin fin, o con el fin antes, es una sola fecha', () => {
  assert.deepStrictEqual(buildOccurrenceDates('2026-10-17', null, 'daily').dates, ['2026-10-17']);
  assert.deepStrictEqual(buildOccurrenceDates('2026-10-17', '2026-10-01', 'daily').dates, ['2026-10-17']);
  assert.deepStrictEqual(buildOccurrenceDates('no', '2026-10-01', 'daily').dates, []);
});

test('isFrequency', () => {
  assert.strictEqual(isFrequency('weekly'), true);
  assert.strictEqual(isFrequency('yearly'), false);
});
