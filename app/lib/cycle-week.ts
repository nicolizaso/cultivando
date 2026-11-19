/**
 * SEMANA DE CICLO
 * ------------------------------------------------------------------
 * En qué momento está un ciclo: la etapa, la semana de esa etapa y el día,
 * cuándo empezó (o se prevé que empiece) la flora y la cosecha aproximada
 * según la meta de semanas del ciclo. También la cuenta al revés: "flora,
 * semana 6, día 1" → fecha.
 *
 * La semana es la misma que usa la dosis de fertilizante (`weekInStage`): el
 * día del cambio de etapa es el día 0 de la semana 1.
 *
 * Nada se guarda: se calcula siempre desde las fechas reales de las plantas.
 * Si alguna planta ya pasó a flora, esa fecha (la más temprana) manda sobre
 * el pase previsto del ciclo.
 */

import { addDaysToKey, dateKey, daysBetweenKeys } from './dates.ts';
import { dominantStage, stagePeriods } from './climate.ts';
import { weekInStage } from './nutrition.ts';
import { STAGE_DATE_COLUMNS } from './stage-logic.ts';
import type { StageName } from './stage-logic.ts';

/** La meta de flora si el ciclo no tiene otra. */
export const DEFAULT_FLOWER_WEEKS = 8;
export const MIN_FLOWER_WEEKS = 1;
export const MAX_FLOWER_WEEKS = 30;

export type WeekStage = 'Vegetativo' | 'Floración';

type PlantLike = {
  stage?: string | null;
  is_archived?: boolean | null;
  stage_updated_at?: string | null;
} & Partial<Record<(typeof STAGE_DATE_COLUMNS)[StageName], string | null>>;

export interface CycleScheduleFields {
  flower_target_weeks?: number | null;
  planned_flower_start?: string | null;
}

/** Lo mínimo para ubicar cualquier día del ciclo. Serializable: viaja al cliente. */
export interface CycleWeekRef {
  /** La etapa de la mayoría de las plantas activas. */
  stage: StageName | null;
  /** Desde cuándo está en esa etapa ("YYYY-MM-DD"). */
  stageStart: string | null;
  vegStart: string | null;
  /** Inicio de flora: el real más temprano o, si no hay, el previsto. */
  flowerStart: string | null;
  /** El inicio de flora es el previsto (todavía no pasó ninguna planta). */
  flowerPlanned: boolean;
  /** Desde cuándo se seca: a partir de ahí ya no hay semanas de flora. */
  dryStart: string | null;
  targetWeeks: number;
}

export interface CycleTimeline extends CycleWeekRef {
  /** Semana de la etapa (solo vegetativo y floración). */
  week: number | null;
  /** Días en la etapa actual (0 = el día del cambio). */
  dayInStage: number | null;
  harvestApprox: string | null;
  /** Semanas que faltan hasta la cosecha aproximada (0 si ya pasó). */
  weeksLeft: number | null;
  /** Semanas de flora por encima de la meta. */
  overTarget: number;
}

export function clampTargetWeeks(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_FLOWER_WEEKS;
  return Math.min(MAX_FLOWER_WEEKS, Math.max(MIN_FLOWER_WEEKS, n));
}

export function cycleWeekRef(plants: PlantLike[], cycle: CycleScheduleFields): CycleWeekRef {
  const active = plants.filter((plant) => !plant.is_archived);
  const stage = dominantStage(active);
  const periods = stagePeriods(active);
  const startOf = (name: StageName) => periods.find((period) => period.stage === name)?.from ?? null;

  const stageStart = stage
    ? startOf(stage) ?? active
      .filter((plant) => plant.stage === stage)
      .map((plant) => dateKey(plant.stage_updated_at ?? null))
      .filter((day): day is string => Boolean(day))
      .sort()[0] ?? null
    : null;

  const vegStart = startOf('Vegetativo') ?? (stage === 'Vegetativo' ? stageStart : null);
  const realFlower = startOf('Floración') ?? (stage === 'Floración' ? stageStart : null);
  const planned = dateKey(cycle.planned_flower_start ?? null);
  const dryStart = startOf('Secado') ?? (stage === 'Secado' ? stageStart : null);

  return {
    stage,
    stageStart,
    vegStart,
    flowerStart: realFlower ?? planned,
    flowerPlanned: !realFlower && Boolean(planned),
    dryStart,
    targetWeeks: clampTargetWeeks(cycle.flower_target_weeks),
  };
}

export function cycleTimeline(ref: CycleWeekRef, today: string): CycleTimeline {
  const growing = ref.stage === 'Vegetativo' || ref.stage === 'Floración';
  const start = ref.stage === 'Floración' ? ref.flowerStart ?? ref.stageStart
    : ref.stage === 'Vegetativo' ? ref.vegStart ?? ref.stageStart
      : ref.stageStart;

  const dayInStage = start ? Math.max(0, daysBetweenKeys(start, today)) : null;
  const week = growing && dayInStage !== null ? weekInStage(dayInStage) : null;
  const harvestApprox = growing && ref.flowerStart ? addDaysToKey(ref.flowerStart, ref.targetWeeks * 7) : null;
  const weeksLeft = harvestApprox ? Math.max(0, Math.ceil(daysBetweenKeys(today, harvestApprox) / 7)) : null;
  const overTarget = ref.stage === 'Floración' && week !== null ? Math.max(0, week - ref.targetWeeks) : 0;

  return { ...ref, week, dayInStage, harvestApprox, weeksLeft, overTarget };
}

/** La etapa (vege o flora) y su semana un día cualquiera, o null si no cae en ninguna. */
export function stageWeekOn(day: string, ref: CycleWeekRef): { stage: WeekStage; week: number; dayInStage: number; planned: boolean } | null {
  if (ref.dryStart && day >= ref.dryStart) return null;
  if (ref.flowerStart && day >= ref.flowerStart) {
    const dayInStage = daysBetweenKeys(ref.flowerStart, day);
    return { stage: 'Floración', week: weekInStage(dayInStage), dayInStage, planned: ref.flowerPlanned };
  }
  if (ref.vegStart && day >= ref.vegStart) {
    const dayInStage = daysBetweenKeys(ref.vegStart, day);
    return { stage: 'Vegetativo', week: weekInStage(dayInStage), dayInStage, planned: false };
  }
  return null;
}

export const STAGE_SHORT: Record<WeekStage, string> = { Vegetativo: 'V', Floración: 'F' };
export const STAGE_WORD: Record<WeekStage, string> = { Vegetativo: 'Vege', Floración: 'Flora' };

/** "F4" y "Flora · semana 4 · día 24". */
export function weekLabel(day: string, ref: CycleWeekRef): { short: string; long: string; planned: boolean } | null {
  const at = stageWeekOn(day, ref);
  if (!at) return null;
  return {
    short: `${STAGE_SHORT[at.stage]}${at.week}`,
    long: `${STAGE_WORD[at.stage]} · semana ${at.week} · día ${at.dayInStage}`,
    planned: at.planned,
  };
}

/** "Flora, semana 6, día 1" → "YYYY-MM-DD". `dayOfWeek` va de 1 a 7. */
export function dayForStageWeek(stage: WeekStage, week: number, dayOfWeek: number, ref: CycleWeekRef): string | null {
  const start = stage === 'Floración' ? ref.flowerStart : ref.vegStart;
  if (!start) return null;
  const w = Math.max(1, Math.floor(week));
  const d = Math.min(7, Math.max(1, Math.floor(dayOfWeek)));
  return addDaysToKey(start, (w - 1) * 7 + (d - 1));
}
