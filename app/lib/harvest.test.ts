import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cycleYield, dominantStrain, estimateHarvest, parseHarvestInput, spaceArea, strainYields } from './harvest.ts';

test('parseHarvestInput - valida fechas, pesos y calificación', () => {
  assert.deepEqual(parseHarvestInput({ harvested_on: '2026-10-01', wet_g: '420,5', dry_g: 95, rating: '4', notes: '  rico ' }), {
    data: { harvested_on: '2026-10-01', dried_on: null, wet_g: 420.5, dry_g: 95, rating: 4, notes: 'rico' },
    error: null,
  });
  assert.match(parseHarvestInput({ harvested_on: 'ayer' }).error ?? '', /fecha/);
  assert.match(parseHarvestInput({ harvested_on: '2026-10-10', dried_on: '2026-10-01' }).error ?? '', /antes/);
  assert.match(parseHarvestInput({ harvested_on: '2026-10-10', wet_g: 50, dry_g: 80 }).error ?? '', /mayor/);
  assert.match(parseHarvestInput({ harvested_on: '2026-10-10', rating: 9 }).error ?? '', /1 a 5/);
  assert.match(parseHarvestInput({ harvested_on: '2026-10-10', dry_g: 'mucho' }).error ?? '', /seco/);
});

test('spaceArea - cargada o ancho por largo', () => {
  assert.equal(spaceArea({ area_m2: 1.44 }), 1.44);
  assert.equal(spaceArea({ width: 1.2, length: 1.2 }), 1.44);
  assert.equal(spaceArea({}), null);
});

test('cycleYield - totales, por planta, por m² y por watt', () => {
  const y = cycleYield(
    [
      { plant_id: 1, harvested_on: '2026-10-01', wet_g: 400, dry_g: 100 },
      { plant_id: 2, harvested_on: '2026-10-01', wet_g: 300, dry_g: 80 },
      { plant_id: 3, harvested_on: '2026-10-01', wet_g: 350 },
    ],
    { width: 1.2, length: 1.2, light_watts: 300 }
  );
  assert.deepEqual(y, {
    harvested: 3, wetTotal: 1050, dryTotal: 180, dryCount: 2, dryPerPlant: 90,
    perSquareMeter: 125, perWatt: 0.6, dryRatio: 0.26,
  });
  assert.equal(cycleYield([]).dryTotal, null);
});

test('strainYields - seco por planta por genética', () => {
  const yields = strainYields(
    [{ plant_id: 1, harvested_on: 'x', dry_g: 100 }, { plant_id: 2, harvested_on: 'x', dry_g: 80 }, { plant_id: 3, harvested_on: 'x', dry_g: null }],
    new Map([[1, 'Gorilla'], [2, 'gorilla'], [3, 'Gorilla']])
  );
  assert.deepEqual(yields, { gorilla: { avg: 90, n: 2 } });
});

test('estimateHarvest - con la genética o con el valor por defecto', () => {
  const durations = { gorilla: { 'Floración': { avg: 56, n: 3 } }, amnesia: { 'Floración': { avg: 70, n: 1 } } };
  assert.deepEqual(estimateHarvest({ flowerStart: '2026-10-01', strain: 'Gorilla', durations, today: '2026-10-17' }), {
    day: '2026-11-26', daysLeft: 40, basis: 'strain', flowerDays: 56,
  });
  assert.equal(estimateHarvest({ flowerStart: '2026-10-01', strain: 'Amnesia', durations, today: '2026-10-17' })?.basis, 'default');
  assert.equal(estimateHarvest({ flowerStart: null, strain: 'Gorilla', durations, today: '2026-10-17' }), null);
});

test('dominantStrain - la más repetida entre las activas', () => {
  assert.equal(dominantStrain([{ strain: 'A' }, { strain: 'B' }, { strain: 'b' }, { strain: 'A', is_archived: true }]), 'B');
  assert.equal(dominantStrain([]), null);
});
