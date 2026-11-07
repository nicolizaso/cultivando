import { test } from 'node:test';
import assert from 'node:assert';
import {
  averageDays,
  buildFeedLog,
  buildStoredMix,
  comboIncluded,
  describeFeed,
  describeUsage,
  doseForWeek,
  fitsStage,
  formatDose,
  formatDoseWithUnit,
  hasStoredMix,
  mixLabel,
  mixRecipe,
  mixUsage,
  parseMixInput,
  parseWeeklyDosages,
  readFeed,
  readStoredMix,
  resolveMix,
  setItemDose,
  stageDaysForWeek,
  stageWarnings,
  stageWarningText,
  stripRecipe,
  sumFeed,
  toggleCombo,
  toggleProduct,
  weekInStage,
  withRecipe,
} from './nutrition.ts';

const fija = { id: 1, name: 'Raíz', dosage_type: 'fija', fixed_dosage: 2, weekly_dosages: null, stage_category: 'todo' };
const semanal = {
  id: 2,
  name: 'Flora',
  dosage_type: 'semanal',
  fixed_dosage: null,
  weekly_dosages: [{ week: 4, dose: 3 }, { week: 1, dose: 1 }, { week: 2, dose: 1.5 }],
  stage_category: 'floracion',
};
const solido = { id: 3, name: 'Minerales', dosage_type: 'fija', fixed_dosage: 10, weekly_dosages: null, unit: 'g', dose_basis: 'planta', stage_category: 'vegetativo' };
const products = [fija, semanal, solido];

const combo = { id: 10, name: 'Flora completa', products: [{ fertilizer_id: 1, name: 'Raíz' }, { fertilizer_id: 2, name: 'Flora', dose: 4 }] };

test('doseForWeek - dosis fija, con las columnas reales de la base', () => {
  assert.strictEqual(doseForWeek(fija, 1), 2);
  assert.strictEqual(doseForWeek(fija, 9), 2);
  assert.strictEqual(doseForWeek({ ...fija, fixed_dosage: null }, 1), null);
});

test('doseForWeek - tabla semanal: vale la última fila que no se pasa de la semana', () => {
  assert.strictEqual(doseForWeek(semanal, 1), 1);
  assert.strictEqual(doseForWeek(semanal, 2), 1.5);
  assert.strictEqual(doseForWeek(semanal, 3), 1.5);
  assert.strictEqual(doseForWeek(semanal, 4), 3);
  assert.strictEqual(doseForWeek(semanal, 12), 3);
  assert.strictEqual(doseForWeek({ ...semanal, weekly_dosages: [] }, 1), null);
});

test('parseWeeklyDosages - ordena, deduplica y descarta lo inválido', () => {
  assert.deepStrictEqual(
    parseWeeklyDosages([{ week: 2, dose: '1,5' }, { week: 2, dose: 2 }, { week: 0, dose: 1 }, { week: 1, dose: -1 }, { week: 3, dose: 4 }]),
    [{ week: 2, dose: 2 }, { week: 3, dose: 4 }]
  );
  assert.deepStrictEqual(parseWeeklyDosages('nada'), []);
});

test('weekInStage y stageDaysForWeek - día 0 a 6 es la semana 1', () => {
  assert.strictEqual(weekInStage(0), 1);
  assert.strictEqual(weekInStage(6), 1);
  assert.strictEqual(weekInStage(7), 2);
  assert.strictEqual(weekInStage(20), 3);
  assert.strictEqual(weekInStage(null), 1);
  assert.strictEqual(stageDaysForWeek(3), 14);
  assert.strictEqual(weekInStage(stageDaysForWeek(5)), 5);
});

test('resolveMix - dosis del producto para la semana, salvo la elegida a mano', () => {
  const resolved = resolveMix(
    [{ fertilizer_id: 1, name: 'Raíz', custom_dose: null }, { fertilizer_id: 2, name: 'Flora', custom_dose: 4 }, { fertilizer_id: 3, name: 'x', custom_dose: null }],
    products,
    3
  );
  assert.deepStrictEqual(resolved.map((item) => [item.dose, item.custom, item.unit, item.basis]), [
    [2, false, 'ml', 'litro'],
    [4, true, 'ml', 'litro'],
    [10, false, 'g', 'planta'],
  ]);
  assert.strictEqual(resolved[2].name, 'Minerales');
});

test('resolveMix y mixRecipe - un producto borrado queda con "?"', () => {
  const resolved = resolveMix([{ fertilizer_id: 99, name: 'Viejo', custom_dose: null }], products, 1);
  assert.strictEqual(resolved[0].missing, true);
  assert.strictEqual(mixRecipe(resolved, 1), 'Preparar: Viejo: ? ml/L (semana 1)');
});

test('mixRecipe - con unidades y base de cada producto', () => {
  const resolved = resolveMix(
    [{ fertilizer_id: 2, name: 'Flora', custom_dose: null }, { fertilizer_id: 3, name: 'Minerales', custom_dose: null }],
    products,
    2
  );
  assert.strictEqual(mixRecipe(resolved, 2), 'Preparar: Flora: 1,5 ml/L + Minerales: 10 g por planta (semana 2)');
  assert.strictEqual(mixRecipe([], 2), '');
});

test('toggleCombo - suma lo que falta con la dosis del combo, y lo saca si estaba entero', () => {
  const start = [{ fertilizer_id: 3, name: 'Minerales', custom_dose: null }];
  const added = toggleCombo(start, combo);
  assert.deepStrictEqual(added.map((item) => [item.fertilizer_id, item.custom_dose]), [[3, null], [1, null], [2, 4]]);
  assert.strictEqual(comboIncluded(added, combo), true);
  assert.deepStrictEqual(toggleCombo(added, combo), start);
});

test('toggleProduct y setItemDose', () => {
  const items = toggleProduct([], { id: 1, name: 'Raíz' });
  assert.deepStrictEqual(items, [{ fertilizer_id: 1, name: 'Raíz', custom_dose: null }]);
  assert.deepStrictEqual(setItemDose(items, 1, 3)[0].custom_dose, 3);
  assert.deepStrictEqual(toggleProduct(items, { id: 1, name: 'Raíz' }), []);
});

test('mixLabel - combos enteros y productos sueltos', () => {
  const items = toggleCombo([{ fertilizer_id: 3, name: 'Minerales', custom_dose: null }], combo);
  assert.strictEqual(mixLabel(items, [combo]), 'Flora completa + Minerales');
  assert.strictEqual(mixLabel(items.slice(0, 2), [combo]), 'Minerales + Raíz');
  assert.strictEqual(mixLabel([], [combo]), '');
});

test('buildStoredMix y readStoredMix - ida y vuelta', () => {
  const stored = buildStoredMix(toggleCombo([], combo), products, [combo], 15);
  assert.strictEqual(stored.week, 3);
  assert.strictEqual(stored.label, 'Flora completa');
  const read = readStoredMix({ nutrition: stored });
  assert.deepStrictEqual(read?.items, stored.items);
  assert.strictEqual(read?.stage_days, 15);
  assert.strictEqual(read?.resolved?.[1].dose, 4);
  assert.strictEqual(hasStoredMix({ nutrition: stored }), true);
  assert.strictEqual(hasStoredMix({ targets: {} }), false);
});

test('readStoredMix - la forma vieja { type, id, week } se convierte', () => {
  const fromCombo = readStoredMix({ nutrition: { type: 'combo', id: 10, week: 3 } }, [combo], products);
  assert.deepStrictEqual(fromCombo?.items.map((item) => item.fertilizer_id), [1, 2]);
  assert.strictEqual(fromCombo?.stage_days, 14);
  assert.strictEqual(fromCombo?.resolved, null);

  const fromProduct = readStoredMix({ nutrition: { type: 'product', id: 3, week: 1 } }, [], products);
  assert.deepStrictEqual(fromProduct?.items, [{ fertilizer_id: 3, name: 'Minerales', custom_dose: null }]);
  assert.strictEqual(hasStoredMix({ nutrition: { type: 'product', id: 3 } }), true);

  assert.strictEqual(readStoredMix({ nutrition: { type: 'combo', id: 77 } }, [combo]), null);
  assert.strictEqual(readStoredMix(null), null);
});

test('parseMixInput - valida productos, dosis y días', () => {
  assert.deepStrictEqual(
    parseMixInput({ items: [{ fertilizer_id: 1, custom_dose: '2,5' }, { fertilizer_id: 1 }, { fertilizer_id: 2, custom_dose: '' }], stage_days: 9.4 }),
    { items: [{ fertilizer_id: 1, name: 'Producto', custom_dose: 2.5 }, { fertilizer_id: 2, name: 'Producto', custom_dose: null }], stage_days: 9 }
  );
  assert.strictEqual(parseMixInput(null), null);
  assert.strictEqual(parseMixInput({ items: [] }), null);
  assert.strictEqual(parseMixInput({ items: [{ fertilizer_id: 'x' }] }), 'invalid');
  assert.strictEqual(parseMixInput({ items: [{ fertilizer_id: 1, custom_dose: 5000 }] }), 'invalid');
  assert.strictEqual(parseMixInput({ items: [{ fertilizer_id: 1 }], stage_days: -2 }), 'invalid');
});

test('withRecipe y stripRecipe - la receta va y viene sin tocar las notas', () => {
  assert.strictEqual(withRecipe('', 'Preparar: A'), 'Preparar: A');
  assert.strictEqual(withRecipe('Regar lento', 'Preparar: A'), 'Preparar: A\n\nRegar lento');
  assert.strictEqual(withRecipe('Preparar: viejo\n\nRegar lento', 'Preparar: A'), 'Preparar: A\n\nRegar lento');
  assert.strictEqual(withRecipe('Algo', ''), 'Algo');
  assert.strictEqual(stripRecipe('Preparar: A\n\nRegar lento'), 'Regar lento');
  assert.strictEqual(stripRecipe('Preparar: A'), '');
  assert.strictEqual(stripRecipe('Sin receta'), 'Sin receta');
  assert.strictEqual(stripRecipe(withRecipe('Notas', 'Preparar: B')), 'Notas');
});

test('fitsStage y stageWarnings - producto de vegetativo en floración', () => {
  assert.strictEqual(fitsStage('todo', 'Floración'), true);
  assert.strictEqual(fitsStage('vegetativo', 'Floración'), false);
  assert.strictEqual(fitsStage('vegetativo', 'Vegetativo'), true);
  assert.strictEqual(fitsStage('lavado', 'Floración'), true);
  assert.strictEqual(fitsStage('floracion', 'Secado'), true);
  assert.strictEqual(fitsStage(null, 'Floración'), true);

  const warnings = stageWarnings(
    [{ fertilizer_id: 3, name: 'Oro Negro', stage_category: 'vegetativo' }, { fertilizer_id: 1, name: 'Lab', stage_category: 'todo' }],
    ['Floración', 'Floración', null]
  );
  assert.strictEqual(warnings.length, 1);
  assert.strictEqual(stageWarningText(warnings[0]), 'Oro Negro es de vegetativo y las plantas están en floración.');
});

test('mixUsage - por litro usa los litros; por planta, las plantas', () => {
  const resolved = resolveMix(
    [{ fertilizer_id: 1, name: 'Raíz', custom_dose: null }, { fertilizer_id: 3, name: 'Minerales', custom_dose: null }],
    products,
    1
  );
  const lines = mixUsage(resolved, 10, 3);
  assert.deepStrictEqual(lines.map((line) => line.total), [20, 30]);
  assert.strictEqual(describeUsage(lines, 10, 1), 'Raíz: 20 ml + Minerales: 30 g (10 L, semana 1)');
  assert.deepStrictEqual(mixUsage(resolved, 0, 3).map((line) => line.total), [null, 30]);
});

test('buildFeedLog, readFeed y sumFeed - cada planta se queda con su parte', () => {
  const stored = buildStoredMix(
    [{ fertilizer_id: 1, name: 'Raíz', custom_dose: null }, { fertilizer_id: 3, name: 'Minerales', custom_dose: null }],
    products,
    [],
    0
  );
  const { feed, totals } = buildFeedLog(stored, 10, 4);
  assert.deepStrictEqual(totals.map((line) => line.total), [20, 40]);
  assert.deepStrictEqual(feed.usage.map((line) => line.amount), [5, 10]);
  assert.strictEqual(describeFeed(feed), 'Raíz 2 ml/L + Minerales 10 g por planta · 10 L en total · semana 1');

  const rows: { data: unknown; created_at: string }[] = [0, 1, 2, 3].map(() => ({ data: { feed }, created_at: '2026-11-05T15:00:00Z' }));
  rows.push({ data: { feed: buildFeedLog(stored, null, 1).feed }, created_at: '2026-11-08T15:00:00Z' });
  rows.push({ data: { watering: { ph: 6 } }, created_at: '2026-11-08T15:00:00Z' });
  const sums = sumFeed(rows);
  assert.deepStrictEqual(sums.map((row) => [row.name, row.amount, row.unit, row.days]), [
    ['Minerales', 50, 'g', 2],
    ['Raíz', 20, 'ml', 2],
  ]);
  assert.strictEqual(readFeed({ nada: 1 }), null);
});

test('formatDose, formatDoseWithUnit y averageDays', () => {
  assert.strictEqual(formatDose(1.5), '1,5');
  assert.strictEqual(formatDose(0.333), '0,33');
  assert.strictEqual(formatDose(1250), '1.250');
  assert.strictEqual(formatDoseWithUnit(10, 'g', 'planta'), '10 g por planta');
  assert.strictEqual(formatDoseWithUnit(null, 'ml', 'litro'), 'sin dosis');
  assert.strictEqual(averageDays([10, 20, null]), 15);
  assert.strictEqual(averageDays([]), null);
});
