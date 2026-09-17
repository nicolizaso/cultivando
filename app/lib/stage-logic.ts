import type { Plant } from "./types.ts";

// Thresholds configuration
export const STAGE_THRESHOLDS: Record<string, { nextStage: string; days: number }> = {
  'Germinación': { nextStage: 'Plántula', days: 7 },
  'Plántula': { nextStage: 'Vegetativo', days: 21 },
  'Enraizamiento': { nextStage: 'Vegetativo', days: 12 },
  'Vegetativo': { nextStage: 'Floración', days: 60 },
};

/**
 * Checks if a plant is ready to move to the next stage based on its age.
 * @param plant The plant to check
 * @param now Optional current date for testing
 * @returns The next stage name if a suggestion exists, null otherwise
 */
export function getStageSuggestion(plant: Plant, now: Date = new Date()): string | null {
  // Calculate age locally if planted_at is available, otherwise fall back to DB computed or static days
  let age = plant.current_age_days ?? plant.days ?? 0;

  if (plant.planted_at) {
    const planted = new Date(plant.planted_at);
    // Use the provided 'now' for better testability and avoid future dates issues
    const diffTime = now.getTime() - planted.getTime();
    age = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  const threshold = STAGE_THRESHOLDS[plant.stage];

  if (threshold && age >= threshold.days) {
    return threshold.nextStage;
  }

  return null;
}

/**
 * Finds the first plant that has a stage suggestion.
 * @param plants Array of plants to check
 * @param now Optional current date for testing
 * @returns An object with the plant and its next stage, or null if no suggestions
 */
export function getFirstSuggestion(plants: Plant[], now: Date = new Date()): { plant: Plant; nextStage: string } | null {
  for (const plant of plants) {
    const nextStage = getStageSuggestion(plant, now);
    if (nextStage) {
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
