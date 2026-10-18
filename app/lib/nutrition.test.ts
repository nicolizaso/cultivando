import { test } from 'node:test';
import assert from 'node:assert';
import {
  averageDays,
  buildRecipe,
  doseForWeek,
  formatDose,
  parseWeeklyDosages,
  recipeItems,
  weekInStage,
  withRecipe,
} from './nutrition.ts';

const fija = { id: 1, name: 'Raíz', dosage_type: 'fija', fixed_dosage: 2, weekly_dosages: null };
const semanal = {
  id: 2,
  name: 'Flora',
  dosage_type: 'semanal',
  fixed_dosage: null,
  weekly_dosages: [{ week: 4, dose: 3 }, { week: 1, dose: 1 }, { week: 2, dose: 1.5 }],
};

test('doseForWeek - dosis fija, con las columnas reales de la base', () => {
  // La regresión: el código leía `dose_type`/`dose_fixed`, que no existen.
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

test('weekInStage - día 0 a 6 es la semana 1', () => {
  assert.strictEqual(weekInStage(0), 1);
  assert.strictEqual(weekInStage(6), 1);
  assert.strictEqual(weekInStage(7), 2);
  assert.strictEqual(weekInStage(20), 3);
  assert.strictEqual(weekInStage(null), 1);
});

test('recipeItems y buildRecipe - combo con dosis de la semana', () => {
  const combos = [{ id: 10, products: [{ fertilizer_id: 1, name: 'Raíz' }, { fertilizer_id: 2, name: 'Flora' }] }];
  const items = recipeItems({ type: 'combo', id: 10 }, [fija, semanal], combos, 3);
  assert.deepStrictEqual(items.map((item) => item.dose), [2, 1.5]);
  assert.strictEqual(buildRecipe(items, 3), 'Preparar: Raíz: 2 ml/L + Flora: 1,5 ml/L (semana 3)');
});

test('recipeItems - un producto del combo que ya no existe queda con "?"', () => {
  const combos = [{ id: 10, products: [{ fertilizer_id: 99, name: 'Viejo' }] }];
  const items = recipeItems({ type: 'combo', id: 10 }, [fija], combos, 1);
  assert.strictEqual(buildRecipe(items, 1), 'Preparar: Viejo: ? ml/L (semana 1)');
});

test('withRecipe - reemplaza la línea de receta sin tocar el resto', () => {
  assert.strictEqual(withRecipe('', 'Preparar: A'), 'Preparar: A');
  assert.strictEqual(withRecipe('Regar lento', 'Preparar: A'), 'Preparar: A\n\nRegar lento');
  assert.strictEqual(withRecipe('Preparar: viejo\n\nRegar lento', 'Preparar: A'), 'Preparar: A\n\nRegar lento');
  assert.strictEqual(withRecipe('Algo', ''), 'Algo');
});

test('formatDose y averageDays', () => {
  assert.strictEqual(formatDose(1.5), '1,5');
  assert.strictEqual(formatDose(0.333), '0,33');
  assert.strictEqual(averageDays([10, 20, null]), 15);
  assert.strictEqual(averageDays([]), null);
});
