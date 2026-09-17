// Argentina está al oeste de Greenwich, que es donde se rompen las fechas sin
// hora. Se fija el huso antes de crear cualquier Date para que la prueba diga
// lo mismo en la notebook de casa y en el runner del CI, que corre en UTC.
process.env.TZ = 'America/Argentina/Buenos_Aires';

import { test } from 'node:test';
import assert from 'node:assert';
import { getDaysSinceWater, parseCultivationDate, todayForInput } from './dates.ts';

/** Una hora cualquiera del 17 de septiembre, en horario local. */
const now = new Date('2026-09-17T09:00:00');

test('getDaysSinceWater - una fecha sin hora no se corre de día', () => {
  // La regresión concreta: el riego en lote guarda "2026-09-17" y la tarjeta
  // decía "Regada ayer" el mismo día que se había regado.
  assert.strictEqual(getDaysSinceWater('2026-09-17', now), 0);
  assert.strictEqual(getDaysSinceWater('2026-09-16', now), 1);
  assert.strictEqual(getDaysSinceWater('2026-09-10', now), 7);
});

test('getDaysSinceWater - también entiende un ISO completo', () => {
  // Lo que escribe completar una tarea de riego.
  assert.strictEqual(getDaysSinceWater('2026-09-17T23:30:00-03:00', now), 0);
  assert.strictEqual(getDaysSinceWater('2026-09-16T00:10:00-03:00', now), 1);
});

test('getDaysSinceWater - cuenta días, no horas', () => {
  // Regado anoche tarde y mirado a la mañana: es "ayer", no "hace 9 horas".
  assert.strictEqual(getDaysSinceWater('2026-09-16T23:00:00', now), 1);
});

test('getDaysSinceWater - sin registro devuelve null', () => {
  assert.strictEqual(getDaysSinceWater(null, now), null);
  assert.strictEqual(getDaysSinceWater(undefined, now), null);
  assert.strictEqual(getDaysSinceWater('', now), null);
  assert.strictEqual(getDaysSinceWater('cuando me acuerde', now), null);
});

test('getDaysSinceWater - respeta el "Hoy" heredado de la tarjeta', () => {
  assert.strictEqual(getDaysSinceWater('Hoy', now), 0);
});

test('getDaysSinceWater - una fecha futura no da días negativos', () => {
  assert.strictEqual(getDaysSinceWater('2026-09-20', now), 0);
});

test('todayForInput - devuelve el día local, no el UTC', () => {
  // A las 22:00 en Argentina ya son las 01:00 UTC del día siguiente: el
  // formulario tiene que abrir con el 17, no con el 18.
  assert.strictEqual(todayForInput(new Date('2026-09-17T22:00:00')), '2026-09-17');
  assert.strictEqual(todayForInput(new Date('2026-09-17T00:30:00')), '2026-09-17');
});

test('parseCultivationDate - ancla las fechas sin hora al mediodía', () => {
  const parsed = parseCultivationDate('2026-09-17');
  assert.ok(parsed);
  assert.strictEqual(parsed.getDate(), 17);
  assert.strictEqual(parsed.getHours(), 12);
});

test('parseCultivationDate - devuelve null si no se entiende', () => {
  assert.strictEqual(parseCultivationDate('no es una fecha'), null);
});
