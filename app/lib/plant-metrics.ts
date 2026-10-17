/**
 * Métricas de una planta: en qué etapa está, hace cuántos días y qué edad tiene.
 *
 * Es la única fórmula de la app. Antes había dos: esta (con las fechas de cada
 * etapa) y las columnas calculadas de la base (`days_in_stage`, que miraba
 * `stage_updated_at`), y cada pantalla mostraba la suya.
 *
 * - **Etapa actual:** la más avanzada que tiene fecha. Sin ninguna fecha
 *   cargada, la columna `stage`.
 * - **Días en la etapa:** desde la fecha de esa etapa (o `stage_updated_at`
 *   si no hay fechas), en días de calendario de Argentina.
 * - **Edad:** desde la fecha más temprana que se conozca (cualquier etapa o
 *   `planted_at`).
 */
import { daysSinceDate } from './dates.ts';

/** Las columnas de fecha, de la etapa más avanzada a la primera. */
const STAGES_BY_PRIORITY = [
  { key: 'date_curado', label: 'Curado' },
  { key: 'date_secado', label: 'Secado' },
  { key: 'date_floracion', label: 'Floración' },
  { key: 'date_vegetativo', label: 'Vegetativo' },
  { key: 'date_enraizamiento', label: 'Enraizamiento' },
  { key: 'date_plantula', label: 'Plántula' },
  { key: 'date_germinacion', label: 'Germinación' },
] as const;

export type StageDateKey = (typeof STAGES_BY_PRIORITY)[number]['key'];

export type PlantDates = {
  stage?: string | null;
  planted_at?: string | null;
  stage_updated_at?: string | null;
} & Partial<Record<StageDateKey, string | null>>;

export interface PlantMetrics {
  currentStage: string;
  /** Desde cuándo está en la etapa actual (ISO), si se sabe. */
  stageStartedAt: string | null;
  daysInCurrentStage: number;
  totalAge: number;
}

export function getPlantMetrics(plant: PlantDates, now: Date = new Date()): PlantMetrics {
  let currentStage = plant.stage ?? '';
  let stageStartedAt: string | null = null;

  for (const stage of STAGES_BY_PRIORITY) {
    const value = plant[stage.key];
    if (value) {
      currentStage = stage.label;
      stageStartedAt = value;
      break;
    }
  }

  if (!stageStartedAt && plant.stage_updated_at) stageStartedAt = plant.stage_updated_at;

  const knownDates = [...STAGES_BY_PRIORITY.map((stage) => plant[stage.key]), plant.planted_at]
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((entry) => !isNaN(entry.time))
    .sort((a, b) => a.time - b.time);

  const earliest = knownDates[0]?.value ?? null;

  return {
    currentStage,
    stageStartedAt,
    daysInCurrentStage: daysSinceDate(stageStartedAt, now) ?? 0,
    totalAge: daysSinceDate(earliest, now) ?? 0,
  };
}
