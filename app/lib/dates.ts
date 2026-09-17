/**
 * Fechas de cultivo.
 *
 * Vive aparte de `utils.tsx` por una razón práctica: ese archivo tiene JSX y el
 * corredor de tests de Node no lo puede cargar. Acá la lógica queda cubierta
 * por pruebas, que es justo lo que necesita algo tan fácil de romper sin darse
 * cuenta como una cuenta de días entre husos horarios.
 *
 * La regla que atraviesa el archivo: una fecha sin hora ("2026-09-17") la lee
 * JavaScript como medianoche **UTC**, así que al oeste de Greenwich cae el día
 * anterior. Anclarla al mediodía la deja quieta en cualquier huso.
 */

/** Una fecha de calendario pelada, sin hora: "2026-09-17". */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

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
 * Hoy en "YYYY-MM-DD", el formato que espera un `input[type=date]`.
 *
 * Con `toISOString()` la fecha sale en UTC, así que después de las 21:00 en
 * Argentina el formulario abría ya con el día siguiente.
 */
export function todayForInput(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA');
}

/**
 * Días desde el último riego.
 *
 * `last_water` es heterogéneo por herencia: la tarjeta de planta guarda la
 * cadena "Hoy" al regar desde el menú rápido, el riego en lote guarda el día
 * calendario y completar una tarea guarda un ISO completo. Un único lector
 * resuelve los tres casos en vez de repartir la corrección por cada pantalla.
 *
 * Devuelve null cuando no hay registro de riego.
 */
export function getDaysSinceWater(lastWater?: string | null, now: Date = new Date()): number | null {
  if (!lastWater) return null;
  if (lastWater === 'Hoy') return 0;

  const watered = parseCultivationDate(lastWater);
  if (!watered) return null;

  // Se comparan días, no instantes: regar a las 23:00 y mirar a las 8:00 del
  // día siguiente tiene que decir "ayer", no "hace 9 horas".
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  watered.setHours(0, 0, 0, 0);

  return Math.max(0, Math.round((today.getTime() - watered.getTime()) / (1000 * 60 * 60 * 24)));
}
