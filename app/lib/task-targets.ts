/**
 * Las opciones de "Objetivo" del modal de tareas: plantas y ciclos activos,
 * con los días que llevan en su etapa para calcular la dosis de la semana.
 *
 * Lo arman el Panel y la Agenda con la misma función. Las plantas archivadas
 * (muertas o cosechadas) no se ofrecen: no tiene sentido agendarles un riego.
 */
import { getPlantMetrics } from './plant-metrics.ts';
import type { PlantDates } from './plant-metrics.ts';
import { averageDays } from './nutrition.ts';
import { dominantStage } from './climate.ts';

export interface PlantOption {
  id: string;
  name: string;
  space_id?: number;
  cycle_id: number | null;
  days_in_stage: number;
  /** La etapa en que está, para avisar si un producto no le corresponde. */
  stage: string | null;
}

export interface CycleOption {
  id: number;
  name: string;
  space_id?: number;
  /** Promedio de días en etapa de sus plantas activas, o null si no tiene. */
  days_in_stage: number | null;
  /** La etapa de la mayoría de sus plantas activas. */
  stage: string | null;
}

type CycleWithPlants = {
  id: number;
  name: string;
  space_id?: number | null;
  plants?: (PlantDates & { id: number | string; name: string; is_archived?: boolean | null })[] | null;
};

export function buildTaskTargetOptions(
  cycles: CycleWithPlants[],
  now: Date = new Date()
): { plants: PlantOption[]; cycles: CycleOption[] } {
  const plants: PlantOption[] = [];
  const cycleOptions: CycleOption[] = [];

  for (const cycle of cycles) {
    const spaceId = cycle.space_id ?? undefined;
    const active = (cycle.plants ?? []).filter((plant) => !plant.is_archived);
    const days: number[] = [];

    for (const plant of active) {
      const { daysInCurrentStage, currentStage } = getPlantMetrics(plant, now);
      days.push(daysInCurrentStage);
      plants.push({
        id: String(plant.id),
        name: plant.name,
        space_id: spaceId,
        cycle_id: cycle.id,
        days_in_stage: daysInCurrentStage,
        stage: currentStage || null,
      });
    }

    cycleOptions.push({
      id: cycle.id,
      name: cycle.name,
      space_id: spaceId,
      days_in_stage: averageDays(days),
      stage: dominantStage(active),
    });
  }

  return { plants, cycles: cycleOptions };
}

export type TargetRef = { id: string | number; type: 'plant' | 'cycle' | 'space' };

export interface FeedContext {
  /** Días en etapa con los que se calcula la dosis (los del objetivo más nuevo). */
  stageDays: number | null;
  /** Semana más temprana y más avanzada entre los objetivos, para avisar si difieren. */
  minWeek: number | null;
  maxWeek: number | null;
  /** Las etapas de los objetivos, para avisar si un producto no corresponde. */
  stages: string[];
}

/**
 * La semana y la etapa de lo elegido en una tarea. Si los objetivos están en
 * semanas distintas se usa la más temprana: casi todas las tablas suben la
 * dosis con las semanas, y quedarse corto es menos dañino que pasarse.
 */
export function feedContext(targets: TargetRef[], plants: PlantOption[], cycles: CycleOption[]): FeedContext {
  const days: number[] = [];
  const stages: string[] = [];
  const add = (value: number | null | undefined, stage: string | null | undefined) => {
    if (value !== null && value !== undefined && Number.isFinite(value)) days.push(value);
    if (stage) stages.push(stage);
  };

  for (const target of targets) {
    if (target.type === 'plant') {
      const plant = plants.find((item) => String(item.id) === String(target.id));
      add(plant?.days_in_stage, plant?.stage);
    } else if (target.type === 'cycle') {
      const cycle = cycles.find((item) => item.id === Number(target.id));
      add(cycle?.days_in_stage, cycle?.stage);
    } else {
      for (const cycle of cycles.filter((item) => item.space_id === Number(target.id))) add(cycle.days_in_stage, cycle.stage);
    }
  }

  if (days.length === 0) return { stageDays: null, minWeek: null, maxWeek: null, stages: Array.from(new Set(stages)) };
  const min = Math.min(...days);
  const max = Math.max(...days);
  return {
    stageDays: min,
    minWeek: Math.floor(min / 7) + 1,
    maxWeek: Math.floor(max / 7) + 1,
    stages: Array.from(new Set(stages)),
  };
}
