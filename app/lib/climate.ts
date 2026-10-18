/**
 * CLIMA
 * ------------------------------------------------------------------
 * VPD (déficit de presión de vapor) a partir de temperatura y humedad, y su
 * diagnóstico. Puro, para usarlo en la ficha del ciclo y en el historial.
 */

import { STAGE_DATE_COLUMNS, STAGE_NAMES, isStageName } from './stage-logic.ts';
import type { StageName } from './stage-logic.ts';
import { dateKey } from './dates.ts';

/** Presión de vapor de saturación en kPa (fórmula de Tetens). */
export function saturationVaporPressure(temperature: number): number {
  return 0.61078 * Math.exp((17.27 * temperature) / (temperature + 237.3));
}

/** VPD del aire en kPa, o null si falta algún dato o no tiene sentido. */
export function vpd(temperature: number | null | undefined, humidity: number | null | undefined): number | null {
  const t = Number(temperature);
  const h = Number(humidity);
  if (temperature === null || temperature === undefined || humidity === null || humidity === undefined) return null;
  if (!Number.isFinite(t) || !Number.isFinite(h) || h < 0 || h > 100) return null;
  return saturationVaporPressure(t) * (1 - h / 100);
}

export type VpdLevel = 'low' | 'ok' | 'high' | 'unknown';

export interface VpdRange {
  min: number;
  max: number;
}

/** Rango sano por defecto, cuando no se sabe en qué etapa está el ciclo. */
export const DEFAULT_VPD_RANGE: VpdRange = { min: 0.4, max: 1.6 };

export function vpdLevel(value: number | null, range: VpdRange = DEFAULT_VPD_RANGE): VpdLevel {
  if (value === null) return 'unknown';
  if (value < range.min) return 'low';
  if (value > range.max) return 'high';
  return 'ok';
}

/* ------------------------------------------------------------------
 * Rangos por etapa e historial
 * ------------------------------------------------------------------ */


export interface StageClimate {
  /** °C */
  temperature: VpdRange;
  /** % de humedad relativa */
  humidity: VpdRange;
  /** kPa */
  vpd: VpdRange;
}

/**
 * Lo que se suele recomendar para cada etapa. Es una guía, no una regla: el
 * diagnóstico dice "alto" o "bajo", nunca "mal". En el curado la planta ya
 * está en frascos y el clima del espacio no aplica.
 */
export const STAGE_CLIMATE: Partial<Record<StageName, StageClimate>> = {
  'Germinación': { temperature: { min: 22, max: 26 }, humidity: { min: 70, max: 90 }, vpd: { min: 0.4, max: 0.8 } },
  'Plántula': { temperature: { min: 22, max: 26 }, humidity: { min: 65, max: 75 }, vpd: { min: 0.4, max: 0.8 } },
  'Enraizamiento': { temperature: { min: 22, max: 26 }, humidity: { min: 75, max: 90 }, vpd: { min: 0.4, max: 0.8 } },
  'Vegetativo': { temperature: { min: 22, max: 28 }, humidity: { min: 55, max: 70 }, vpd: { min: 0.8, max: 1.2 } },
  'Floración': { temperature: { min: 20, max: 26 }, humidity: { min: 40, max: 50 }, vpd: { min: 1.2, max: 1.6 } },
  'Secado': { temperature: { min: 15, max: 21 }, humidity: { min: 55, max: 65 }, vpd: { min: 0.6, max: 1.0 } },
};

export function stageClimate(stage: string | null | undefined): StageClimate | null {
  return isStageName(stage) ? STAGE_CLIMATE[stage] ?? null : null;
}

/**
 * La etapa del ciclo: la que tiene la mayoría de sus plantas activas. Si hay
 * empate, la más avanzada (el clima se acomoda a la que va adelante).
 */
export function dominantStage(plants: { stage?: string | null; is_archived?: boolean | null }[]): StageName | null {
  const counts = new Map<StageName, number>();
  for (const plant of plants) {
    if (plant.is_archived || !isStageName(plant.stage)) continue;
    counts.set(plant.stage, (counts.get(plant.stage) ?? 0) + 1);
  }
  let best: StageName | null = null;
  for (const [stage, count] of counts) {
    const bestCount = best ? counts.get(best) ?? 0 : -1;
    if (count > bestCount || (count === bestCount && best && STAGE_NAMES.indexOf(stage) > STAGE_NAMES.indexOf(best))) {
      best = stage;
    }
  }
  return best;
}

export interface MeasurementLike {
  date: string | null;
  created_at?: string | null;
  temperature: number | null;
  humidity: number | null;
}

/** Un día del historial: el promedio de las mediciones de ese día. */
export interface ClimatePoint {
  /** "YYYY-MM-DD" */
  day: string;
  temperature: number | null;
  humidity: number | null;
  vpd: number | null;
  /** Cuántas mediciones se promediaron. */
  count: number;
}

function average(values: (number | null)[]): number | null {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/**
 * Las mediciones como serie diaria, de la más vieja a la más nueva. Si un día
 * tiene varias (mañana y noche), se promedian: el gráfico muestra días.
 * El VPD se calcula por medición y después se promedia.
 */
export function climateSeries(measurements: MeasurementLike[]): ClimatePoint[] {
  const byDay = new Map<string, MeasurementLike[]>();
  for (const measurement of measurements) {
    const day = dateKey(measurement.date ?? measurement.created_at ?? null);
    if (!day) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), measurement]);
  }

  return Array.from(byDay, ([day, rows]) => ({
    day,
    temperature: average(rows.map((row) => toNumber(row.temperature))),
    humidity: average(rows.map((row) => toNumber(row.humidity))),
    vpd: average(rows.map((row) => vpd(toNumber(row.temperature), toNumber(row.humidity)))),
    count: rows.length,
  })).sort((a, b) => a.day.localeCompare(b.day));
}

export interface StagePeriod {
  stage: StageName;
  /** Primer día de la etapa ("YYYY-MM-DD"). */
  from: string;
  /** Día en que empezó la siguiente, o null si es la actual. */
  to: string | null;
}

type PlantStageDates = Partial<Record<(typeof STAGE_DATE_COLUMNS)[StageName], string | null>>;

/**
 * Las etapas por las que pasó el ciclo, según el primer día en que alguna de
 * sus plantas entró en cada una. Es aproximado (no todas cambian el mismo
 * día) pero alcanza para saber qué clima hubo en cada etapa.
 */
export function stagePeriods(plants: PlantStageDates[]): StagePeriod[] {
  const starts: { stage: StageName; from: string }[] = [];
  for (const stage of STAGE_NAMES) {
    const column = STAGE_DATE_COLUMNS[stage];
    const days = plants.map((plant) => dateKey(plant[column] ?? null)).filter((day): day is string => Boolean(day));
    if (days.length > 0) starts.push({ stage, from: days.sort()[0] });
  }
  starts.sort((a, b) => a.from.localeCompare(b.from) || STAGE_NAMES.indexOf(a.stage) - STAGE_NAMES.indexOf(b.stage));
  return starts.map((start, index) => ({ ...start, to: starts[index + 1]?.from ?? null }));
}

/** La etapa en la que cayó un día, o null si es anterior a todas. */
export function stageOnDay(day: string, periods: StagePeriod[]): StageName | null {
  const period = periods.find((p) => p.from <= day && (p.to === null || day < p.to));
  return period?.stage ?? null;
}

export interface StageClimateStats {
  stage: StageName;
  /** Días con medición dentro de la etapa. */
  days: number;
  avgTemperature: number | null;
  avgHumidity: number | null;
  avgVpd: number | null;
  /** Fracción (0 a 1) de los días con VPD dentro del rango de la etapa. */
  inRange: number | null;
  range: VpdRange | null;
}

/** El clima de cada etapa del ciclo, en el orden en que pasaron. */
export function climateByStage(points: ClimatePoint[], periods: StagePeriod[]): StageClimateStats[] {
  return periods
    .map((period) => {
      const inPeriod = points.filter((point) => stageOnDay(point.day, periods) === period.stage && point.day >= period.from);
      const range = STAGE_CLIMATE[period.stage]?.vpd ?? null;
      const withVpd = inPeriod.filter((point) => point.vpd !== null);
      return {
        stage: period.stage,
        days: inPeriod.length,
        avgTemperature: average(inPeriod.map((point) => point.temperature)),
        avgHumidity: average(inPeriod.map((point) => point.humidity)),
        avgVpd: average(inPeriod.map((point) => point.vpd)),
        inRange: range && withVpd.length > 0
          ? withVpd.filter((point) => vpdLevel(point.vpd, range) === 'ok').length / withVpd.length
          : null,
        range,
      };
    })
    .filter((stats) => stats.days > 0);
}
