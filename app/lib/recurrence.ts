/**
 * Fechas de una tarea que se repite.
 *
 * Trabaja con días de calendario ("YYYY-MM-DD") y no con objetos Date, así no
 * depende del huso del servidor. Dos cosas que antes fallaban:
 *
 * - **Mensual desde un 31.** `setMonth` sobre el 31 de enero daba el 3 de
 *   marzo, y desde ahí toda la serie quedaba corrida. Ahora cada mes cae en
 *   el mismo día que el inicio, o en el último día si el mes es más corto.
 * - **El tope.** Una serie se cortaba en 50 sin decir nada (una diaria de
 *   tres meses quedaba en siete semanas). Ahora se avisa con `truncated`.
 */
import { addDaysToKey } from './dates.ts';

export const FREQUENCIES = ['daily', 'every2days', 'weekly', 'biweekly', 'monthly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** Máximo de repeticiones de una serie: una diaria de tres meses. */
export const MAX_OCCURRENCES = 90;

const STEP_DAYS: Record<Exclude<Frequency, 'monthly'>, number> = {
  daily: 1,
  every2days: 2,
  weekly: 7,
  biweekly: 14,
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function monthlyKey(startKey: string, offset: number): string {
  const [year, month, day] = startKey.split('-').map(Number);
  const totalMonths = month - 1 + offset;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

export function isFrequency(value: unknown): value is Frequency {
  return typeof value === 'string' && (FREQUENCIES as readonly string[]).includes(value);
}

/**
 * Los días de la serie, del inicio al fin inclusive.
 * Sin fecha de fin (o con el fin antes del inicio) es una sola fecha.
 */
export function buildOccurrenceDates(
  startKey: string,
  endKey: string | null | undefined,
  frequency: Frequency,
  max: number = MAX_OCCURRENCES
): { dates: string[]; truncated: boolean } {
  if (!DATE_ONLY.test(startKey)) return { dates: [], truncated: false };
  if (!endKey || !DATE_ONLY.test(endKey) || endKey < startKey) return { dates: [startKey], truncated: false };

  const dates: string[] = [];
  for (let i = 0; ; i++) {
    const key = frequency === 'monthly' ? monthlyKey(startKey, i) : addDaysToKey(startKey, i * STEP_DAYS[frequency]);
    if (key > endKey) return { dates, truncated: false };
    if (dates.length === max) return { dates, truncated: true };
    dates.push(key);
  }
}
