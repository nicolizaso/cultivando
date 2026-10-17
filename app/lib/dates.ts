/**
 * Fechas de cultivo.
 *
 * Vive aparte de `utils.tsx` por una razón práctica: ese archivo tiene JSX y el
 * corredor de tests de Node no lo puede cargar. Acá la lógica queda cubierta
 * por pruebas, que es justo lo que necesita algo tan fácil de romper sin darse
 * cuenta como una cuenta de días entre husos horarios.
 *
 * Dos reglas atraviesan el archivo:
 *
 * 1. Una fecha sin hora ("2026-09-17") la lee JavaScript como medianoche
 *    **UTC**, así que al oeste de Greenwich cae el día anterior. Anclarla al
 *    mediodía la deja quieta en cualquier huso.
 * 2. "Hoy" es el día en Argentina, no el del servidor. Vercel corre en UTC:
 *    desde las 21:00 de Buenos Aires el servidor ya está en mañana, y el panel
 *    mostraba las tareas del día siguiente como si fueran de hoy.
 */

/** El huso de la app. Fijo por decisión: se puede volver configurable más adelante. */
export const APP_TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** Una fecha de calendario pelada, sin hora: "2026-09-17". */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const DAY_MS = 1000 * 60 * 60 * 24;

const keyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Lee una fecha que puede venir con hora o sin ella.
 *
 * Devuelve null si no se entiende, para que quien llama decida qué mostrar.
 */
export function parseCultivationDate(value: string): Date | null {
  const parsed = new Date(DATE_ONLY.test(value) ? `${value}T12:00:00` : value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * El día de calendario en Argentina ("YYYY-MM-DD") de un instante o de una
 * fecha. Una fecha sin hora se toma tal cual: ya es un día de calendario.
 */
export function dateKey(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && DATE_ONLY.test(value)) return value;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return null;
  return keyFormatter.format(date);
}

/** Hoy en Argentina, en "YYYY-MM-DD". */
export function todayKey(now: Date = new Date()): string {
  return keyFormatter.format(now);
}

/**
 * Hoy en "YYYY-MM-DD", el formato que espera un `input[type=date]`.
 *
 * Con `toISOString()` la fecha sale en UTC, así que después de las 21:00 en
 * Argentina el formulario abría ya con el día siguiente.
 */
export function todayForInput(now: Date = new Date()): string {
  return todayKey(now);
}

function keyToUtc(key: string): number {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Días de calendario entre dos "YYYY-MM-DD" (negativo si `to` es anterior). */
export function daysBetweenKeys(from: string, to: string): number {
  return Math.round((keyToUtc(to) - keyToUtc(from)) / DAY_MS);
}

/** "YYYY-MM-DD" corrido `days` días. */
export function addDaysToKey(key: string, days: number): string {
  const date = new Date(keyToUtc(key) + days * DAY_MS);
  return date.toISOString().slice(0, 10);
}

/**
 * Días de calendario transcurridos desde una fecha, nunca negativos.
 * Devuelve null si la fecha no se entiende.
 */
export function daysSinceDate(value: Date | string | null | undefined, now: Date = new Date()): number | null {
  const from = dateKey(value);
  if (!from) return null;
  return Math.max(0, daysBetweenKeys(from, todayKey(now)));
}

/**
 * Días desde el último riego.
 *
 * `last_water` es heterogéneo por herencia: la tarjeta de planta guardaba la
 * cadena "Hoy" al regar desde el menú rápido, el riego en lote guarda el día
 * calendario y completar una tarea guarda un ISO completo. Un único lector
 * resuelve los tres casos en vez de repartir la corrección por cada pantalla.
 *
 * Se comparan días, no instantes: regar a las 23:00 y mirar a las 8:00 del
 * día siguiente tiene que decir "ayer", no "hace 9 horas".
 *
 * Devuelve null cuando no hay registro de riego.
 */
export function getDaysSinceWater(lastWater?: string | null, now: Date = new Date()): number | null {
  if (!lastWater) return null;
  if (lastWater === 'Hoy') return 0;
  return daysSinceDate(lastWater, now);
}

/** "17/10/2026": un día en formato argentino, o '' si no se entiende. */
export function formatDay(value: Date | string | null | undefined): string {
  const key = dateKey(value);
  if (!key) return '';
  const [year, month, day] = key.split('-');
  return `${day}/${month}/${year}`;
}
