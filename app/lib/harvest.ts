/**
 * COSECHA Y RENDIMIENTO
 * ------------------------------------------------------------------
 * Peso húmedo y seco de cada planta, y lo que rindió un ciclo: gramos secos
 * por planta, por metro cuadrado y por watt de luz. También cuándo se espera
 * cosechar un ciclo en floración. Puro.
 */

import { addDaysToKey, dateKey, daysBetweenKeys } from './dates.ts';
import { strainKey } from './strain-stats.ts';
import type { StrainDurations } from './strain-stats.ts';

export interface HarvestRow {
  plant_id: number;
  cycle_id?: number | null;
  harvested_on: string;
  dried_on?: string | null;
  wet_g?: number | null;
  dry_g?: number | null;
  rating?: number | null;
  notes?: string | null;
}

export interface HarvestInput {
  harvested_on: string;
  dried_on: string | null;
  wet_g: number | null;
  dry_g: number | null;
  rating: number | null;
  notes: string | null;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function grams(value: unknown, label: string): number | null | string {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(number) || number < 0 || number > 100000) return `Revisá ${label}: tiene que ser un número de gramos.`;
  return Math.round(number * 10) / 10;
}

/** Valida lo que llega del formulario. Devuelve los datos o el error en palabras. */
export function parseHarvestInput(input: unknown): { data: HarvestInput; error: null } | { data: null; error: string } {
  const raw = (input ?? {}) as Record<string, unknown>;

  const harvested = typeof raw.harvested_on === 'string' ? raw.harvested_on.slice(0, 10) : '';
  if (!DATE_ONLY.test(harvested)) return { data: null, error: 'La fecha de cosecha no es válida.' };

  const driedRaw = typeof raw.dried_on === 'string' ? raw.dried_on.slice(0, 10) : '';
  const dried = driedRaw === '' ? null : driedRaw;
  if (dried !== null && !DATE_ONLY.test(dried)) return { data: null, error: 'La fecha de fin de secado no es válida.' };
  if (dried !== null && dried < harvested) return { data: null, error: 'El secado no puede terminar antes de la cosecha.' };

  const wet = grams(raw.wet_g, 'el peso húmedo');
  if (typeof wet === 'string') return { data: null, error: wet };
  const dry = grams(raw.dry_g, 'el peso seco');
  if (typeof dry === 'string') return { data: null, error: dry };
  if (wet !== null && dry !== null && dry > wet) return { data: null, error: 'El peso seco no puede ser mayor que el húmedo.' };

  const ratingNumber = raw.rating === null || raw.rating === undefined || raw.rating === '' ? null : Math.round(Number(raw.rating));
  if (ratingNumber !== null && (!Number.isFinite(ratingNumber) || ratingNumber < 1 || ratingNumber > 5)) {
    return { data: null, error: 'La calificación va de 1 a 5.' };
  }

  const notes = typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 2000) || null : null;

  return { data: { harvested_on: harvested, dried_on: dried, wet_g: wet, dry_g: dry, rating: ratingNumber, notes }, error: null };
}

export interface SpaceSize {
  area_m2?: number | null;
  width?: number | null;
  length?: number | null;
  light_watts?: number | null;
}

/** Superficie del espacio en m²: la cargada o ancho × largo. */
export function spaceArea(space: SpaceSize | null | undefined): number | null {
  if (!space) return null;
  if (space.area_m2 && space.area_m2 > 0) return space.area_m2;
  if (space.width && space.length && space.width > 0 && space.length > 0) return Math.round(space.width * space.length * 100) / 100;
  return null;
}

export interface CycleYield {
  /** Plantas con cosecha registrada. */
  harvested: number;
  wetTotal: number | null;
  dryTotal: number | null;
  /** Plantas con peso seco, para el promedio. */
  dryCount: number;
  dryPerPlant: number | null;
  perSquareMeter: number | null;
  perWatt: number | null;
  /** Peso seco sobre húmedo (cuánto quedó después de secar), 0 a 1. */
  dryRatio: number | null;
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

export function cycleYield(harvests: HarvestRow[], space?: SpaceSize | null): CycleYield {
  const wets = harvests.map((h) => h.wet_g).filter((v): v is number => v != null);
  const withDry = harvests.filter((h) => h.dry_g != null);
  const dryTotal = withDry.length > 0 ? withDry.reduce((sum, h) => sum + Number(h.dry_g), 0) : null;
  const pairs = harvests.filter((h) => h.dry_g != null && h.wet_g != null && Number(h.wet_g) > 0);
  const area = spaceArea(space);
  const watts = space?.light_watts && space.light_watts > 0 ? space.light_watts : null;

  return {
    harvested: harvests.length,
    wetTotal: wets.length > 0 ? round1(wets.reduce((sum, v) => sum + Number(v), 0)) : null,
    dryTotal: dryTotal === null ? null : round1(dryTotal),
    dryCount: withDry.length,
    dryPerPlant: dryTotal === null ? null : round1(dryTotal / withDry.length),
    perSquareMeter: dryTotal !== null && area ? round1(dryTotal / area) : null,
    perWatt: dryTotal !== null && watts ? round2(dryTotal / watts) : null,
    dryRatio: pairs.length > 0
      ? round2(pairs.reduce((sum, h) => sum + Number(h.dry_g), 0) / pairs.reduce((sum, h) => sum + Number(h.wet_g), 0))
      : null,
  };
}

/** Gramos secos por planta de cada genética (para la página de genéticas). */
export function strainYields(
  harvests: HarvestRow[],
  plantStrain: Map<number, string | null | undefined>
): Record<string, { avg: number; n: number }> {
  const byStrain = new Map<string, number[]>();
  for (const harvest of harvests) {
    if (harvest.dry_g == null) continue;
    const key = strainKey(plantStrain.get(Number(harvest.plant_id)));
    if (!key) continue;
    byStrain.set(key, [...(byStrain.get(key) ?? []), Number(harvest.dry_g)]);
  }
  return Object.fromEntries(
    Array.from(byStrain, ([key, values]) => [key, { avg: round1(values.reduce((s, v) => s + v, 0) / values.length), n: values.length }])
  );
}

/** Días de floración que se suponen si la genética no tiene historia. */
export const DEFAULT_FLOWER_DAYS = 63;

export interface HarvestEstimate {
  /** "YYYY-MM-DD" */
  day: string;
  daysLeft: number;
  /** De dónde salen los días de floración. */
  basis: 'strain' | 'default';
  flowerDays: number;
}

/**
 * Cuándo se espera cosechar un ciclo: el día en que empezó a florecer más
 * los días de floración de su genética (promedio de lo que ya cultivaste, con
 * 2 plantas o más) o, si no hay datos, DEFAULT_FLOWER_DAYS.
 */
export function estimateHarvest(options: {
  flowerStart: string | null | undefined;
  strain: string | null | undefined;
  durations: StrainDurations;
  today: string;
  minSamples?: number;
}): HarvestEstimate | null {
  const start = dateKey(options.flowerStart ?? null);
  if (!start) return null;
  const key = strainKey(options.strain);
  const average = key ? options.durations[key]?.['Floración'] : undefined;
  const useStrain = Boolean(average && average.n >= (options.minSamples ?? 2));
  const flowerDays = useStrain && average ? average.avg : DEFAULT_FLOWER_DAYS;
  const day = addDaysToKey(start, flowerDays);
  return { day, daysLeft: daysBetweenKeys(options.today, day), basis: useStrain ? 'strain' : 'default', flowerDays };
}

/** La genética que más se repite entre las plantas activas. */
export function dominantStrain(plants: { strain?: string | null; is_archived?: boolean | null }[]): string | null {
  const counts = new Map<string, { name: string; n: number }>();
  for (const plant of plants) {
    if (plant.is_archived) continue;
    const key = strainKey(plant.strain);
    if (!key) continue;
    const entry = counts.get(key) ?? { name: String(plant.strain).trim(), n: 0 };
    entry.n++;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.name ?? null;
}
