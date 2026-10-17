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

export interface PlantOption {
  id: string;
  name: string;
  space_id?: number;
  cycle_id: number | null;
  days_in_stage: number;
}

export interface CycleOption {
  id: number;
  name: string;
  space_id?: number;
  /** Promedio de días en etapa de sus plantas activas, o null si no tiene. */
  days_in_stage: number | null;
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
      const { daysInCurrentStage } = getPlantMetrics(plant, now);
      days.push(daysInCurrentStage);
      plants.push({
        id: String(plant.id),
        name: plant.name,
        space_id: spaceId,
        cycle_id: cycle.id,
        days_in_stage: daysInCurrentStage,
      });
    }

    cycleOptions.push({ id: cycle.id, name: cycle.name, space_id: spaceId, days_in_stage: averageDays(days) });
  }

  return { plants, cycles: cycleOptions };
}
