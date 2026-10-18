// Argentina está al oeste de Greenwich, que es donde se rompen las fechas sin
// hora. Se fija el huso antes de crear cualquier Date para que la prueba diga
// lo mismo en la notebook de casa y en el runner del CI, que corre en UTC.
process.env.TZ = 'America/Argentina/Buenos_Aires';

import { test } from 'node:test';
import assert from 'node:assert';
import { addDaysToKey, dateKey, dayRange, daysBetweenKeys, daysSinceDate, formatDay, formatInAppTz, getDaysSinceWater, parseCultivationDate, todayForInput, todayKey } from './dates.ts';

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

test('todayKey - el día es el de Argentina aunque el servidor esté en UTC', () => {
  // 22:30 en Buenos Aires = 01:30 UTC del día siguiente.
  assert.strictEqual(todayKey(new Date('2026-10-18T01:30:00Z')), '2026-10-17');
  assert.strictEqual(todayKey(new Date('2026-10-18T03:30:00Z')), '2026-10-18');
});

test('dateKey - instantes al día de Argentina; fechas sin hora, tal cual', () => {
  assert.strictEqual(dateKey('2026-10-17'), '2026-10-17');
  assert.strictEqual(dateKey('2026-10-17T12:00:00+00:00'), '2026-10-17');
  assert.strictEqual(dateKey('2026-10-18T02:00:00Z'), '2026-10-17');
  assert.strictEqual(dateKey('cualquier cosa'), null);
  assert.strictEqual(dateKey(null), null);
});

test('daysBetweenKeys y addDaysToKey - cruzan meses y años', () => {
  assert.strictEqual(daysBetweenKeys('2026-01-30', '2026-03-01'), 30);
  assert.strictEqual(daysBetweenKeys('2026-12-31', '2027-01-01'), 1);
  assert.strictEqual(daysBetweenKeys('2026-03-01', '2026-01-30'), -30);
  assert.strictEqual(addDaysToKey('2026-02-27', 3), '2026-03-02');
});

test('daysSinceDate - nunca negativo y null si no se entiende', () => {
  const at = new Date('2026-10-17T15:00:00Z');
  assert.strictEqual(daysSinceDate('2026-10-10', at), 7);
  assert.strictEqual(daysSinceDate('2026-10-20', at), 0);
  assert.strictEqual(daysSinceDate('nunca', at), null);
});

test('formatDay - día argentino, sin correrse', () => {
  assert.strictEqual(formatDay('2026-10-17'), '17/10/2026');
  assert.strictEqual(formatDay('2026-10-18T02:00:00Z'), '17/10/2026');
  assert.strictEqual(formatDay(null), '');
});

test('dayRange - el día de Argentina en instantes', () => {
  const { from, to } = dayRange('2026-10-17');
  assert.strictEqual(new Date(from).toISOString(), '2026-10-17T03:00:00.000Z');
  assert.strictEqual(new Date(to).toISOString(), '2026-10-18T03:00:00.000Z');
  // Una tarea a las 23:30 de Argentina cae en ese día aunque en UTC ya sea mañana.
  const late = new Date('2026-10-18T02:30:00Z').getTime();
  assert.ok(late >= new Date(from).getTime() && late < new Date(to).getTime());
});

test('formatInAppTz - formatea en el huso de Argentina', () => {
  // 01:00 UTC del 18 son las 22:00 del 17 en Argentina.
  assert.strictEqual(formatInAppTz('2026-10-18T01:00:00Z', { day: 'numeric', month: 'numeric' }), '17/10');
  assert.strictEqual(formatInAppTz('2026-10-17', { day: 'numeric', month: 'numeric' }), '17/10');
  assert.strictEqual(formatInAppTz(null, { day: 'numeric' }), '');
  assert.strictEqual(formatInAppTz('basura', { day: 'numeric' }), '');
});
