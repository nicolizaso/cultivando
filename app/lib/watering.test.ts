import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeDoses, describeWatering, doseForLiters, ecToPpm, parseWateringData, readWatering } from './watering.ts';

test('parseWateringData - acepta coma, reparte litros y redondea', () => {
  const result = parseWateringData({ liters_total: '10', ph: '6,2', ec: '1.45', runoff_ph: '' }, 4);
  assert.deepEqual(result, { data: { liters_total: 10, ph: 6.2, ec: 1.45, liters_per_plant: 2.5 }, error: null });
});

test('parseWateringData - fuera de rango o basura da error en palabras', () => {
  assert.match(parseWateringData({ ph: '15' }).error ?? '', /pH/);
  assert.match(parseWateringData({ ec: 'mucho' }).error ?? '', /EC/);
  assert.deepEqual(parseWateringData({}), { data: {}, error: null });
});

test('readWatering - lee logs.data.watering y descarta lo que no es número', () => {
  assert.deepEqual(readWatering({ watering: { ph: 6.1, ec: '1,2', liters_total: 2 } }), { ph: 6.1, liters_total: 2 });
  assert.equal(readWatering({ watering: {} }), null);
  assert.equal(readWatering(null), null);
});

test('describeWatering - texto corto para la bitácora', () => {
  assert.equal(
    describeWatering({ liters_total: 10, liters_per_plant: 2.5, ph: 6.2, ec: 1.4, runoff_ph: 6.5 }),
    '2,5 L por planta (10 L en total) · pH 6,2 · EC 1,4 (700 ppm) · drenaje pH 6,5'
  );
  assert.equal(describeWatering({ liters_total: 2, liters_per_plant: 2 }), '2 L');
  assert.equal(ecToPpm(1.2, 700), 840);
});

test('doseForLiters y describeDoses - ml de cada producto', () => {
  const lines = doseForLiters([{ fertilizerId: 1, name: 'Grow', dose: 2 }, { fertilizerId: 2, name: 'Raíz', dose: null }], 10);
  assert.deepEqual(lines, [{ fertilizerId: 1, name: 'Grow', perLiter: 2, total: 20 }, { fertilizerId: 2, name: 'Raíz', perLiter: null, total: null }]);
  assert.equal(describeDoses(lines, 10, 3), 'Grow: 20 ml + Raíz: ? (10 L, semana 3)');
  assert.equal(doseForLiters([{ fertilizerId: 1, name: 'Grow', dose: 2 }], 0)[0].total, null);
});
