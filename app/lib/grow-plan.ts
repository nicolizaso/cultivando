/**
 * PLAN DE CULTIVO AUTOMÁTICO
 * ------------------------------------------------------------------
 * Arma, para un ciclo, el calendario de lo que viene: riegos cada tantos
 * días, cuáles llevan fertilizante (con el producto de la etapa y su semana),
 * el pase a floración, el lavado de raíces y la cosecha. Los días de cada
 * etapa salen de lo que eligió el usuario (con el promedio de su genética
 * como sugerencia). Puro: la vista previa y el servidor usan lo mismo.
 */

import { addDaysToKey, daysBetweenKeys } from './dates.ts';
import { weekInStage } from './nutrition.ts';
import type { NutritionSelection } from './nutrition.ts';
import type { StageName } from './stage-logic.ts';

/** Lo mismo que acepta `create_tasks` en una sola llamada. */
export const MAX_PLAN_ITEMS = 200;

/** Días que suelen faltar para llegar a vegetativo desde cada etapa inicial. */
export const DAYS_TO_VEG: Partial<Record<StageName, number>> = {
  'Germinación': 21,
  'Plántula': 14,
  'Enraizamiento': 12,
};

export const DEFAULT_VEG_DAYS = 35;

export type PlanTaskType = 'riego' | 'fertilizante' | 'cambio_etapa' | 'lavado' | 'cosechar';

export interface GrowPlanOptions {
  today: string;
  /** La etapa del ciclo hoy y el día en que empezó. */
  currentStage: StageName;
  stageStart: string;
  /** Duración total del vegetativo (desde que empieza). */
  vegDays: number;
  flowerDays: number;
  /** Días entre riegos. */
  waterEvery: number;
  /** Uno de cada N riegos lleva fertilizante (0: ninguno). */
  feedEvery: number;
  /** Días antes de la cosecha con agua sola (y una tarea de lavado). */
  flushDays: number;
  vegNutrition: NutritionSelection | null;
  flowerNutrition: NutritionSelection | null;
  include: { stageChange: boolean; harvest: boolean; flush: boolean };
}

export interface PlanItem {
  /** Estable para la misma configuración: sirve para destildar en la vista previa. */
  key: string;
  day: string;
  type: PlanTaskType;
  /** La etapa en la que cae. */
  stage: StageName | 'Previa';
  /** Semana dentro de esa etapa (para la dosis). */
  week: number;
  targetStage?: StageName;
  nutrition?: NutritionSelection;
}

export interface GrowPlan {
  items: PlanItem[];
  vegStart: string;
  flowerStart: string;
  harvestDay: string;
  /** Hubo que cortar porque superaba MAX_PLAN_ITEMS. */
  truncated: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));

/** null si el ciclo ya cosechó (secado o curado): no hay plan que armar. */
export function buildGrowPlan(options: GrowPlanOptions): GrowPlan | null {
  const { today, currentStage, stageStart, include } = options;
  if (currentStage === 'Secado' || currentStage === 'Curado') return null;

  const vegDays = clamp(options.vegDays, 1, 365);
  const flowerDays = clamp(options.flowerDays, 1, 200);
  const waterEvery = clamp(options.waterEvery, 1, 30);
  const feedEvery = clamp(options.feedEvery, 0, 10);
  const flushDays = clamp(options.flushDays, 0, 30);

  const vegStart = currentStage === 'Vegetativo' || currentStage === 'Floración'
    ? stageStart
    : addDaysToKey(stageStart, DAYS_TO_VEG[currentStage] ?? 0);
  const flowerStart = currentStage === 'Floración' ? stageStart : addDaysToKey(vegStart, vegDays);
  const harvestDay = addDaysToKey(flowerStart, flowerDays);
  const flushStart = addDaysToKey(harvestDay, -flushDays);

  const stageOf = (day: string): PlanItem['stage'] =>
    day < vegStart ? 'Previa' : day < flowerStart ? 'Vegetativo' : 'Floración';
  const weekOf = (day: string, stage: PlanItem['stage']) =>
    stage === 'Floración' ? weekInStage(daysBetweenKeys(flowerStart, day))
      : stage === 'Vegetativo' ? weekInStage(daysBetweenKeys(vegStart, day))
        : weekInStage(daysBetweenKeys(stageStart, day));

  const items: PlanItem[] = [];
  const future = (day: string) => day > today;

  // Riegos: desde mañana, cada `waterEvery` días, hasta el día anterior a la cosecha.
  let feedable = 0;
  for (let day = addDaysToKey(today, 1); day < harvestDay; day = addDaysToKey(day, waterEvery)) {
    const stage = stageOf(day);
    const nutrition = stage === 'Vegetativo' ? options.vegNutrition : stage === 'Floración' ? options.flowerNutrition : null;
    const flushing = include.flush && flushDays > 0 && day >= flushStart;
    let feed = false;
    if (nutrition && !flushing && feedEvery > 0) {
      feed = feedable % feedEvery === 0;
      feedable++;
    }
    items.push({
      key: `${feed ? 'fertilizante' : 'riego'}-${day}`,
      day,
      type: feed ? 'fertilizante' : 'riego',
      stage,
      week: weekOf(day, stage),
      ...(feed && nutrition ? { nutrition } : {}),
    });
  }

  if (include.stageChange) {
    if (currentStage !== 'Vegetativo' && currentStage !== 'Floración' && future(vegStart)) {
      items.push({ key: `cambio-${vegStart}-Vegetativo`, day: vegStart, type: 'cambio_etapa', stage: 'Vegetativo', week: 1, targetStage: 'Vegetativo' });
    }
    if (currentStage !== 'Floración' && future(flowerStart)) {
      items.push({ key: `cambio-${flowerStart}-Floración`, day: flowerStart, type: 'cambio_etapa', stage: 'Floración', week: 1, targetStage: 'Floración' });
    }
  }

  if (include.flush && flushDays > 0 && future(flushStart)) {
    items.push({ key: `lavado-${flushStart}`, day: flushStart, type: 'lavado', stage: 'Floración', week: weekOf(flushStart, 'Floración') });
  }

  if (include.harvest && future(harvestDay)) {
    items.push({ key: `cosechar-${harvestDay}`, day: harvestDay, type: 'cosechar', stage: 'Floración', week: weekOf(harvestDay, 'Floración') });
  }

  const order: Record<PlanTaskType, number> = { cambio_etapa: 0, lavado: 1, fertilizante: 2, riego: 3, cosechar: 4 };
  items.sort((a, b) => a.day.localeCompare(b.day) || order[a.type] - order[b.type]);

  return {
    items: items.slice(0, MAX_PLAN_ITEMS),
    vegStart,
    flowerStart,
    harvestDay,
    truncated: items.length > MAX_PLAN_ITEMS,
  };
}

/** Cuántas tareas de cada tipo tiene el plan, para el resumen. */
export function countByType(items: PlanItem[]): Record<PlanTaskType, number> {
  const counts: Record<PlanTaskType, number> = { riego: 0, fertilizante: 0, cambio_etapa: 0, lavado: 0, cosechar: 0 };
  for (const item of items) counts[item.type]++;
  return counts;
}
