/**
 * PLAN DE CULTIVO AUTOMÁTICO
 * ------------------------------------------------------------------
 * Arma, para un ciclo, el calendario de lo que viene: riegos cada tantos
 * días, cuáles llevan fertilizante (con el producto de la etapa y su semana),
 * el pase a floración, el lavado de raíces y la cosecha, más las tareas
 * propias del usuario (podas, entrenamiento…) ubicadas por semana de etapa.
 * Los días de cada
 * etapa salen de lo que eligió el usuario (con el promedio de su genética
 * como sugerencia). Puro: la vista previa y el servidor usan lo mismo.
 */

import { addDaysToKey, daysBetweenKeys } from './dates.ts';
import { weekInStage } from './nutrition.ts';
import type { MixItem } from './nutrition.ts';
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

export type BasePlanType = 'riego' | 'fertilizante' | 'cambio_etapa' | 'lavado' | 'cosechar';

/** Las tareas propias que se pueden sumar al plan, ubicadas por semana de etapa. */
export const CUSTOM_PLAN_TYPES = ['poda', 'entrenamiento', 'repelente', 'trasplante', 'otro'] as const;
export type CustomPlanType = (typeof CUSTOM_PLAN_TYPES)[number];

export type PlanTaskType = BasePlanType | CustomPlanType;

export const MAX_CUSTOM_TASKS = 40;
export const MAX_CUSTOM_NOTE = 120;

/** "Defoliación · flora semana 3, día 1": una tarea propia del plan. */
export interface CustomPlanTask {
  /** Estable mientras se edita (la vista previa lo usa como clave). */
  id: string;
  type: CustomPlanType;
  stage: 'Vegetativo' | 'Floración';
  /** Semana de la etapa (1 a 30). */
  week: number;
  /** Día dentro de esa semana (1 a 7). */
  day: number;
  note?: string;
}

export function isCustomPlanType(value: unknown): value is CustomPlanType {
  return typeof value === 'string' && (CUSTOM_PLAN_TYPES as readonly string[]).includes(value);
}

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
  /** La mezcla de cada etapa (vacía o null: sin fertilizante). */
  vegNutrition: MixItem[] | null;
  flowerNutrition: MixItem[] | null;
  include: { stageChange: boolean; harvest: boolean; flush: boolean };
  /** Tareas propias por semana de etapa. */
  custom?: CustomPlanTask[];
}

export interface PlanItem {
  /** Estable para la misma configuración: sirve para destildar en la vista previa. */
  key: string;
  day: string;
  type: PlanTaskType;
  /** La etapa en la que cae. */
  stage: StageName | 'Previa';
  /** Días dentro de esa etapa y la semana que les toca (para la dosis). */
  stageDays: number;
  week: number;
  targetStage?: StageName;
  nutrition?: MixItem[];
  /** Nota de una tarea propia. */
  note?: string;
}

/** Una tarea propia que no entra en el plan, y por qué. */
export interface SkippedCustomTask {
  task: CustomPlanTask;
  day: string;
  reason: 'past' | 'after_harvest';
}

export interface GrowPlan {
  items: PlanItem[];
  vegStart: string;
  flowerStart: string;
  harvestDay: string;
  /** Hubo que cortar porque superaba MAX_PLAN_ITEMS. */
  truncated: boolean;
  /** Tareas propias que caen antes de hoy o después de la cosecha: no se crean. */
  skipped: SkippedCustomTask[];
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
  const daysOf = (day: string, stage: PlanItem['stage']) => Math.max(0,
    stage === 'Floración' ? daysBetweenKeys(flowerStart, day)
      : stage === 'Vegetativo' ? daysBetweenKeys(vegStart, day)
        : daysBetweenKeys(stageStart, day));
  const timing = (day: string, stage: PlanItem['stage']) => {
    const stageDays = daysOf(day, stage);
    return { stageDays, week: weekInStage(stageDays) };
  };

  const items: PlanItem[] = [];
  const future = (day: string) => day > today;

  // Riegos: desde mañana, cada `waterEvery` días, hasta el día anterior a la cosecha.
  let feedable = 0;
  for (let day = addDaysToKey(today, 1); day < harvestDay; day = addDaysToKey(day, waterEvery)) {
    const stage = stageOf(day);
    const mix = stage === 'Vegetativo' ? options.vegNutrition : stage === 'Floración' ? options.flowerNutrition : null;
    const nutrition = mix && mix.length > 0 ? mix : null;
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
      ...timing(day, stage),
      ...(feed && nutrition ? { nutrition } : {}),
    });
  }

  if (include.stageChange) {
    if (currentStage !== 'Vegetativo' && currentStage !== 'Floración' && future(vegStart)) {
      items.push({ key: `cambio-${vegStart}-Vegetativo`, day: vegStart, type: 'cambio_etapa', stage: 'Vegetativo', stageDays: 0, week: 1, targetStage: 'Vegetativo' });
    }
    if (currentStage !== 'Floración' && future(flowerStart)) {
      items.push({ key: `cambio-${flowerStart}-Floración`, day: flowerStart, type: 'cambio_etapa', stage: 'Floración', stageDays: 0, week: 1, targetStage: 'Floración' });
    }
  }

  if (include.flush && flushDays > 0 && future(flushStart)) {
    items.push({ key: `lavado-${flushStart}`, day: flushStart, type: 'lavado', stage: 'Floración', ...timing(flushStart, 'Floración') });
  }

  if (include.harvest && future(harvestDay)) {
    items.push({ key: `cosechar-${harvestDay}`, day: harvestDay, type: 'cosechar', stage: 'Floración', ...timing(harvestDay, 'Floración') });
  }

  const skipped: SkippedCustomTask[] = [];
  for (const task of options.custom ?? []) {
    const start = task.stage === 'Floración' ? flowerStart : vegStart;
    const week = clamp(task.week, 1, 30);
    const stageDays = (week - 1) * 7 + clamp(task.day, 1, 7) - 1;
    const day = addDaysToKey(start, stageDays);
    // En floración el vegetativo ya pasó: no hay semanas de vege por delante.
    const vegGone = task.stage === 'Vegetativo' && currentStage === 'Floración';
    if (vegGone || day < today) {
      skipped.push({ task, day, reason: 'past' });
      continue;
    }
    if (day > harvestDay) {
      skipped.push({ task, day, reason: 'after_harvest' });
      continue;
    }
    const note = task.note?.trim().slice(0, MAX_CUSTOM_NOTE) || undefined;
    items.push({ key: `propia-${task.id}`, day, type: task.type, stage: task.stage, stageDays, week, ...(note ? { note } : {}) });
  }

  const order: Partial<Record<PlanTaskType, number>> = { cambio_etapa: 0, lavado: 1, fertilizante: 3, riego: 4, cosechar: 5 };
  const rank = (type: PlanTaskType) => order[type] ?? 2;
  items.sort((a, b) => a.day.localeCompare(b.day) || rank(a.type) - rank(b.type));

  return {
    items: items.slice(0, MAX_PLAN_ITEMS),
    vegStart,
    flowerStart,
    harvestDay,
    truncated: items.length > MAX_PLAN_ITEMS,
    skipped,
  };
}

/** Cuántas tareas de cada tipo tiene el plan, para el resumen ("propias" junta las del usuario). */
export function countByType(items: PlanItem[]): Record<BasePlanType | 'propias', number> {
  const counts: Record<BasePlanType | 'propias', number> = { riego: 0, fertilizante: 0, cambio_etapa: 0, lavado: 0, cosechar: 0, propias: 0 };
  for (const item of items) {
    if (isCustomPlanType(item.type)) counts.propias++;
    else counts[item.type]++;
  }
  return counts;
}
