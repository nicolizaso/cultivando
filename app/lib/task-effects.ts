import { isStageName, STAGE_NAMES } from "./stage-logic.ts";
import type { StageName } from "./stage-logic.ts";

/**
 * Qué le pasa a las plantas cuando se completa una tarea.
 *
 * Completar una tarea no es sólo tachar un renglón: cosechar significa que la
 * planta se cortó y está secándose, declararla muerta significa que ya no está
 * en el cultivo. Antes esto había que hacerlo a mano después de tildar la
 * tarea, y lo normal era olvidarse. Acá se decide, sin tocar la base, qué
 * cambio corresponde a cada tipo; la server action sólo lo aplica.
 */

export interface StageEffect {
  kind: 'stage';
  stage: StageName;
  /**
   * Si es true, las plantas que ya están en esa etapa o en una posterior se
   * dejan como están. Cosechar una planta que ya está curándose no la
   * devuelve a secado.
   */
  onlyForward: boolean;
}

export interface WaterEffect {
  kind: 'water';
}

export interface ArchiveEffect {
  kind: 'archive';
}

export type TaskEffect = StageEffect | WaterEffect | ArchiveEffect;

/** La etapa en la que entra una planta al cosecharla. */
export const HARVEST_STAGE: StageName = 'Secado';

interface CompletableTask {
  type?: string | null;
  application_type?: string | null;
  target_stage?: string | null;
}

/**
 * El efecto que tiene completar la tarea, o null si no toca nada.
 *
 * El esquejado y el cambio de ambiente no pasan por acá: el primero necesita
 * datos que sólo da su modal y el segundo mueve ciclos, no plantas.
 */
export function getTaskCompletionEffect(task: CompletableTask): TaskEffect | null {
  switch (task.type) {
    case 'riego':
      return { kind: 'water' };
    case 'fertilizante':
      // Sólo cuenta como riego si el fertilizante se aplicó en el agua.
      return task.application_type === 'Riego' ? { kind: 'water' } : null;
    case 'cambio_etapa':
      // `target_stage` viene de la base pero lo eligió el cliente: si no es una
      // de las siete etapas no se escribe nada.
      return isStageName(task.target_stage)
        ? { kind: 'stage', stage: task.target_stage, onlyForward: false }
        : null;
    case 'cosechar':
      return { kind: 'stage', stage: HARVEST_STAGE, onlyForward: true };
    case 'muerta':
      return { kind: 'archive' };
    default:
      return null;
  }
}

/**
 * ¿Hay que mover esta planta a `effect.stage`?
 *
 * Una etapa que no está entre las siete (por ejemplo el "Esqueje" heredado)
 * se toma como anterior a todas, así que la planta avanza.
 */
export function shouldApplyStage(currentStage: string | null | undefined, effect: StageEffect): boolean {
  if (currentStage === effect.stage) return false;
  if (!effect.onlyForward) return true;

  const current = isStageName(currentStage) ? STAGE_NAMES.indexOf(currentStage) : -1;
  return current < STAGE_NAMES.indexOf(effect.stage);
}
