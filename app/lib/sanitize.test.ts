import { test } from 'node:test';
import assert from 'node:assert';
import { oneOf, optionalNumber, optionalText, parseDecimal, parseId, parseIds, pickFields, requiredText } from './sanitize.ts';

const spaceSchema = {
  name: requiredText(80),
  type: oneOf(['Indoor', 'Outdoor', 'Mixto'] as const),
  width: optionalNumber({ min: 0, max: 100 }),
  light_watts: optionalNumber({ min: 0, max: 100000, integer: true }),
  light_type: optionalText(80),
};

test('pickFields - ignora columnas que no están en la lista', () => {
  // La regresión: `updateSpace` pasaba el objeto entero a `.update()`.
  const { data, invalid } = pickFields(
    { name: 'Carpa', user_id: 'otro-usuario', id: 99, created_at: 'x' },
    spaceSchema
  );
  assert.deepStrictEqual(data, { name: 'Carpa' });
  assert.deepStrictEqual(invalid, []);
});

test('pickFields - informa lo que vino pero no se entiende', () => {
  const { data, invalid } = pickFields({ name: '   ', type: 'Galpón', width: 'mucho' }, spaceSchema);
  assert.deepStrictEqual(data, {});
  assert.deepStrictEqual(invalid.sort(), ['name', 'type', 'width']);
});

test('pickFields - vacío borra el dato y los números aceptan coma', () => {
  const { data } = pickFields({ width: '1,2', light_watts: '600.4', light_type: '' }, spaceSchema);
  assert.deepStrictEqual(data, { width: 1.2, light_watts: 600, light_type: null });
});

test('pickFields - un campo ausente o undefined no se toca', () => {
  const { data } = pickFields({ width: undefined }, spaceSchema);
  assert.deepStrictEqual(data, {});
});

test('optionalNumber - respeta el rango', () => {
  const parse = optionalNumber({ min: 0, max: 14 });
  assert.strictEqual(parse('6.5'), 6.5);
  assert.notStrictEqual(parse(-1), -1);
  assert.notStrictEqual(parse(20), 20);
});

test('parseDecimal - como se escribe en Argentina', () => {
  assert.strictEqual(parseDecimal('1,5'), 1.5);
  assert.strictEqual(parseDecimal('1.5'), 1.5);
  assert.strictEqual(parseDecimal('1.000'), 1000);
  assert.strictEqual(parseDecimal('12.500'), 12500);
  assert.strictEqual(parseDecimal('1.000,5'), 1000.5);
  assert.strictEqual(parseDecimal('1,000.5'), 1000.5);
  assert.strictEqual(parseDecimal('1 000'), 1000);
  assert.strictEqual(parseDecimal('0.75'), 0.75);
  assert.strictEqual(parseDecimal(''), undefined);
  assert.strictEqual(parseDecimal(null), undefined);
  assert.ok(Number.isNaN(parseDecimal('1,2,3')));
  assert.ok(Number.isNaN(parseDecimal('mucho')));
});

test('optionalNumber - un envase de "1.000" ml son mil, no uno', () => {
  assert.strictEqual(optionalNumber({ min: 1, max: 100000 })('1.000'), 1000);
  assert.strictEqual(optionalNumber()('   '), null);
});

test('parseId y parseIds - sólo enteros positivos, sin repetidos', () => {
  assert.strictEqual(parseId('12'), 12);
  assert.strictEqual(parseId('12abc'), null);
  assert.strictEqual(parseId(0), null);
  assert.deepStrictEqual(parseIds([3, '3', 'x', -1, 4.5, 7]), [3, 7]);
  assert.deepStrictEqual(parseIds('1,2'), []);
});
