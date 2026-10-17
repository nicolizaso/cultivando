/**
 * ESTADÍSTICAS POR GENÉTICA
 * ------------------------------------------------------------------
 * Cuánto dura de verdad cada etapa en cada genética, según las plantas que ya
 * pasaron por ella, y qué tan seguido se pierde o se cosecha. Con eso las
 * sugerencias de cambio de etapa dejan de ser una regla fija para todas: una
 * genética que florece en 56 días no recibe el mismo aviso que una de 70.
 *
 * Puro: la página trae las plantas y acá se hacen las cuentas.
 */

import { dateKey, daysBetweenKeys } from './dates.ts';
import { STAGE_DATE_COLUMNS, STAGE_NAMES, STAGE_THRESHOLDS, getStageSuggestion, isStageName } from './stage-logic.ts';
import type { StageName } from './stage-logic.ts';
import { getPlantMetrics } from './plant-metrics.ts';
import type { PlantDates } from './plant-metrics.ts';
import type { Plant } from './types.ts';

/** Con menos plantas que esto, el promedio de una genética no se usa para sugerir. */
export const MIN_SAMPLES = 2;

export type StrainPlant = PlantDates & {
  id: number;
  strain?: string | null;
  is_archived?: boolean | null;
  cycle_id?: number | null;
  source_type?: string | null;
};

/** Las columnas que hacen falta, para pedirlas en un select (y tiparlas). */
export const STRAIN_PLANT_COLUMNS =
  'id, strain, stage, is_archived, cycle_id, source_type, planted_at, stage_updated_at, date_germinacion, date_plantula, date_enraizamiento, date_vegetativo, date_floracion, date_secado, date_curado' as const;

/** "Gorilla  Glue" y "gorilla glue" son la misma genética. */
export function strainKey(strain: string | null | undefined): string | null {
  if (typeof strain !== 'string') return null;
  const key = strain.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  return key || null;
}

/**
 * Cuántos días duró cada etapa que la planta ya terminó: desde su fecha hasta
 * la fecha de la etapa que vino después. La etapa en curso no cuenta: todavía
 * no se sabe cuánto va a durar.
 */
export function stageDurations(plant: PlantDates): Partial<Record<StageName, number>> {
  const dated = STAGE_NAMES
    .map((stage) => ({ stage, day: dateKey(plant[STAGE_DATE_COLUMNS[stage]] ?? null) }))
    .filter((entry): entry is { stage: StageName; day: string } => Boolean(entry.day))
    .sort((a, b) => a.day.localeCompare(b.day) || STAGE_NAMES.indexOf(a.stage) - STAGE_NAMES.indexOf(b.stage));

  const durations: Partial<Record<StageName, number>> = {};
  for (let i = 0; i < dated.length - 1; i++) {
    const days = daysBetweenKeys(dated[i].day, dated[i + 1].day);
    if (days > 0) durations[dated[i].stage] = days;
  }
  return durations;
}

export interface Average {
  avg: number;
  n: number;
}

function averageOf(values: number[]): Average | null {
  if (values.length === 0) return null;
  return { avg: Math.round(values.reduce((sum, v) => sum + v, 0) / values.length), n: values.length };
}

export interface StrainStats {
  key: string;
  /** El nombre tal como más se escribió. */
  name: string;
  plants: number;
  active: number;
  cycles: number;
  seeds: number;
  clones: number;
  /** Llegaron a secado o curado. */
  harvested: number;
  /** Archivadas sin haber llegado a cosecharse (muertas o descartadas). */
  lost: number;
  /** Pérdidas sobre las plantas que ya terminaron, o null si ninguna terminó. */
  lossRate: number | null;
  stages: Partial<Record<StageName, Average>>;
  /** Desde la primera fecha hasta el secado. */
  toHarvest: Average | null;
}

function isHarvested(plant: StrainPlant): boolean {
  return Boolean(plant.date_secado || plant.date_curado) || ['Secado', 'Curado', 'Cosechada'].includes(String(plant.stage));
}

function firstDay(plant: StrainPlant): string | null {
  const days = [plant.planted_at, ...STAGE_NAMES.map((stage) => plant[STAGE_DATE_COLUMNS[stage]])]
    .map((value) => dateKey(value ?? null))
    .filter((day): day is string => Boolean(day))
    .sort();
  return days[0] ?? null;
}

export function strainStats(plants: StrainPlant[]): StrainStats[] {
  const groups = new Map<string, StrainPlant[]>();
  for (const plant of plants) {
    const key = strainKey(plant.strain);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), plant]);
  }

  return Array.from(groups, ([key, group]) => {
    const spellings = new Map<string, number>();
    for (const plant of group) {
      const name = String(plant.strain).trim().replace(/\s+/g, ' ');
      spellings.set(name, (spellings.get(name) ?? 0) + 1);
    }
    const name = [...spellings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];

    const perStage = new Map<StageName, number[]>();
    for (const plant of group) {
      for (const [stage, days] of Object.entries(stageDurations(plant)) as [StageName, number][]) {
        perStage.set(stage, [...(perStage.get(stage) ?? []), days]);
      }
    }
    const stages: Partial<Record<StageName, Average>> = {};
    for (const [stage, values] of perStage) {
      const average = averageOf(values);
      if (average) stages[stage] = average;
    }

    const harvested = group.filter(isHarvested);
    const lost = group.filter((plant) => plant.is_archived && !isHarvested(plant));
    const finished = harvested.length + lost.length;

    const toHarvest = averageOf(
      harvested
        .map((plant) => {
          const start = firstDay(plant);
          const end = dateKey(plant.date_secado ?? null);
          return start && end ? daysBetweenKeys(start, end) : null;
        })
        .filter((days): days is number => days !== null && days > 0)
    );

    return {
      key,
      name,
      plants: group.length,
      active: group.filter((plant) => !plant.is_archived).length,
      cycles: new Set(group.map((plant) => plant.cycle_id).filter((id) => id != null)).size,
      seeds: group.filter((plant) => plant.source_type !== 'Esqueje').length,
      clones: group.filter((plant) => plant.source_type === 'Esqueje').length,
      harvested: harvested.length,
      lost: lost.length,
      lossRate: finished > 0 ? lost.length / finished : null,
      stages,
      toHarvest,
    };
  }).sort((a, b) => b.plants - a.plants || a.name.localeCompare(b.name, 'es'));
}

/** Lo que necesita el sugeridor: duración promedio por genética y etapa. */
export type StrainDurations = Record<string, Partial<Record<StageName, Average>>>;

export function strainDurationIndex(stats: StrainStats[]): StrainDurations {
  return Object.fromEntries(stats.map((strain) => [strain.key, strain.stages]));
}

/** La etapa que sigue a cada una, cuando se sugiere con datos propios. */
const NEXT_STAGE: Partial<Record<StageName, StageName>> = {
  'Germinación': 'Plántula',
  'Plántula': 'Vegetativo',
  'Enraizamiento': 'Vegetativo',
  'Vegetativo': 'Floración',
  // Sin datos no se sugiere cosechar: depende demasiado de la genética.
  'Floración': 'Secado',
};

export interface StageSuggestion {
  plant: Plant;
  nextStage: string;
  /** De dónde sale: el promedio de la genética o la regla general. */
  basis: 'strain' | 'default';
  /** Con datos de la genética: días promedio de la etapa y en cuántas plantas. */
  average?: Average;
  daysInStage: number;
}

/**
 * La sugerencia para una planta. Si su genética tiene al menos MIN_SAMPLES
 * plantas que ya terminaron la etapa, se usa su promedio de días en esa
 * etapa; si no, la regla general de siempre.
 */
export function suggestStage(plant: Plant, now: Date = new Date(), durations: StrainDurations = {}): StageSuggestion | null {
  if (plant.is_archived) return null;
  const { currentStage, daysInCurrentStage } = getPlantMetrics(plant, now);
  const stage = currentStage || plant.stage || '';
  const key = strainKey(plant.strain);
  const average = key && isStageName(stage) ? durations[key]?.[stage] : undefined;
  const next = isStageName(stage) ? NEXT_STAGE[stage] : undefined;

  if (average && average.n >= MIN_SAMPLES && next) {
    return daysInCurrentStage >= average.avg
      ? { plant, nextStage: next, basis: 'strain', average, daysInStage: daysInCurrentStage }
      : null;
  }

  const fallback = getStageSuggestion(plant, now);
  return fallback && STAGE_THRESHOLDS[stage]
    ? { plant, nextStage: fallback, basis: 'default', daysInStage: daysInCurrentStage }
    : null;
}

/** La primera sugerencia de la lista, salteando las descartadas. */
export function firstStageSuggestion(
  plants: Plant[],
  now: Date = new Date(),
  durations: StrainDurations = {},
  isDismissed: (plantId: number, nextStage: string) => boolean = () => false
): StageSuggestion | null {
  for (const plant of plants) {
    const suggestion = suggestStage(plant, now, durations);
    if (suggestion && !isDismissed(plant.id, suggestion.nextStage)) return suggestion;
  }
  return null;
}
