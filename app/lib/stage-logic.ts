import type { Plant } from "./types.ts";
import { getPlantMetrics } from "./plant-metrics.ts";

// Thresholds configuration
export const STAGE_THRESHOLDS: Record<string, { nextStage: string; days: number }> = {
  'Germinación': { nextStage: 'Plántula', days: 7 },
  'Plántula': { nextStage: 'Vegetativo', days: 21 },
  'Enraizamiento': { nextStage: 'Vegetativo', days: 12 },
  'Vegetativo': { nextStage: 'Floración', days: 60 },
};

/**
 * ¿Le toca pasar a la etapa siguiente? Mira la edad total de la planta (desde
 * la primera fecha que se le conoce) contra el umbral de su etapa actual.
 * Las archivadas nunca reciben sugerencias.
 *
 * @returns La etapa sugerida, o null.
 */
export function getStageSuggestion(plant: Plant, now: Date = new Date()): string | null {
  if (plant.is_archived) return null;

  const { currentStage, totalAge } = getPlantMetrics(plant, now);
  const threshold = STAGE_THRESHOLDS[currentStage || plant.stage];

  if (threshold && totalAge >= threshold.days) {
    return threshold.nextStage;
  }

  return null;
}

/**
 * La primera planta con una sugerencia, salteando las que el usuario ya
 * descartó (`isDismissed`).
 */
export function getFirstSuggestion(
  plants: Plant[],
  now: Date = new Date(),
  isDismissed: (plantId: number, nextStage: string) => boolean = () => false
): { plant: Plant; nextStage: string } | null {
  for (const plant of plants) {
    const nextStage = getStageSuggestion(plant, now);
    if (nextStage && !isDismissed(plant.id, nextStage)) {
      return { plant, nextStage };
    }
  }
  return null;
}

/**
 * Las siete etapas que la app deja elegir, en el orden en que ocurren, y la
 * columna donde cada una anota su fecha.
 *
 * El mismo mapa estaba copiado en el modal de cambio de etapa y en el
 * completado de tareas, cada uno con su propio orden. Vive acá, al lado del
 * resto del conocimiento sobre etapas, y el servidor lo usa para no escribir
 * una columna que venga elegida desde el cliente.
 *
 * "Enraizamiento" es la puerta de entrada de los esquejes, igual que
 * "Germinación" lo es de las semillas; por eso van las dos al principio.
 */
export const STAGE_DATE_COLUMNS = {
  'Germinación': 'date_germinacion',
  'Plántula': 'date_plantula',
  'Enraizamiento': 'date_enraizamiento',
  'Vegetativo': 'date_vegetativo',
  'Floración': 'date_floracion',
  'Secado': 'date_secado',
  'Curado': 'date_curado',
} as const;

export type StageName = keyof typeof STAGE_DATE_COLUMNS;

/** Las etapas en orden, para pintar un desplegable sin repetir la lista. */
export const STAGE_NAMES = Object.keys(STAGE_DATE_COLUMNS) as StageName[];

export function isStageName(value: unknown): value is StageName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(STAGE_DATE_COLUMNS, value);
}

/**
 * Columna de fecha de una etapa, o null si el nombre no es una de las siete.
 * Devolver null es lo que impide que un `stage` cualquiera termine escribiendo
 * una columna arbitraria de `plants`.
 */
export function getStageDateColumn(stage: unknown): string | null {
  return isStageName(stage) ? STAGE_DATE_COLUMNS[stage] : null;
}
