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

/**
 * La fecha con la que se registra el efecto: el día en que la tarea estaba
 * agendada, no el día en que alguien se acordó de tildarla. Cosechar el 19 y
 * marcarlo el 24 tiene que dejar el secado empezando el 19.
 *
 * Si la tarea se completa antes de tiempo se usa el momento de completarla:
 * una etapa no puede empezar en el futuro.
 */
export function getTaskEffectDate(dueDate: string | null | undefined, now: Date = new Date()): string {
  const due = dueDate ? new Date(dueDate) : null;
  if (!due || isNaN(due.getTime()) || due.getTime() > now.getTime()) return now.toISOString();
  return due.toISOString();
}

/**
 * A quién apunta la tarea: ciclos enteros y plantas sueltas. Se guarda en
 * `metadata.targets` al crearla.
 *
 * `task_plants` sola no alcanza: es la foto de las plantas del ciclo el día
 * en que se agendó, y un ciclo gana y pierde plantas en el medio.
 */
export interface TaskTargets {
  cycle_ids: number[];
  plant_ids: number[];
}

export interface TargetPlant {
  id: number;
  cycle_id?: number | null;
  stage?: string | null;
  is_archived?: boolean | null;
}

function toIds(values: unknown): number[] | null {
  if (!Array.isArray(values)) return null;
  const ids = values.map(Number).filter((id) => Number.isInteger(id) && id > 0);
  return Array.from(new Set(ids));
}

/** Lee `metadata.targets`, o null si la tarea es de antes de que existiera. */
export function readTaskTargets(metadata: unknown): TaskTargets | null {
  const targets = (metadata as { targets?: unknown } | null)?.targets as
    | { cycle_ids?: unknown; plant_ids?: unknown }
    | undefined;
  if (!targets || typeof targets !== 'object') return null;

  const cycleIds = toIds(targets.cycle_ids);
  const plantIds = toIds(targets.plant_ids);
  if (!cycleIds || !plantIds) return null;
  return { cycle_ids: cycleIds, plant_ids: plantIds };
}

/**
 * Para las tareas viejas, sin `metadata.targets`, se deduce desde las tablas
 * de cruce. Al crear una tarea para una planta suelta también se enlaza su
 * ciclo, así que un ciclo enlazado no alcanza para saber si la tarea era de
 * todo el ciclo. Se toma como ciclo entero el que tiene enlazadas dos o más
 * de sus plantas actuales; en los demás cuentan sólo las plantas enlazadas
 * que siguen ahí.
 */
export function inferLegacyTargets(
  linkedPlants: TargetPlant[],
  taskCycleIds: number[]
): TaskTargets {
  const cycles = new Set(taskCycleIds.map(Number));

  const linkedPerCycle = new Map<number, number>();
  for (const plant of linkedPlants) {
    if (plant.cycle_id != null && cycles.has(Number(plant.cycle_id))) {
      const id = Number(plant.cycle_id);
      linkedPerCycle.set(id, (linkedPerCycle.get(id) ?? 0) + 1);
    }
  }

  const wholeCycles = Array.from(cycles).filter((id) => (linkedPerCycle.get(id) ?? 0) >= 2);
  const whole = new Set(wholeCycles);

  // Una planta enlazada que ya no está en ninguno de los ciclos de la tarea
  // se fue a otro ciclo después de agendarla: la tarea ya no es suya.
  const plantIds = linkedPlants
    .filter((plant) =>
      plant.cycle_id == null
        ? cycles.size === 0
        : cycles.has(Number(plant.cycle_id)) && !whole.has(Number(plant.cycle_id))
    )
    .map((plant) => Number(plant.id));

  return { cycle_ids: wholeCycles, plant_ids: Array.from(new Set(plantIds)) };
}

/**
 * Las plantas sobre las que cae el efecto: las elegidas una por una más las
 * que están hoy en los ciclos elegidos. Las archivadas quedan afuera.
 */
export function resolveTaskPlants(
  targets: TaskTargets,
  plantsById: TargetPlant[],
  plantsOfCycles: TargetPlant[]
): TargetPlant[] {
  const cycles = new Set(targets.cycle_ids);
  const chosen = new Set(targets.plant_ids);
  const result = new Map<number, TargetPlant>();

  for (const plant of plantsById) {
    if (chosen.has(Number(plant.id))) result.set(Number(plant.id), plant);
  }
  for (const plant of plantsOfCycles) {
    if (plant.cycle_id != null && cycles.has(Number(plant.cycle_id))) result.set(Number(plant.id), plant);
  }

  return Array.from(result.values()).filter((plant) => !plant.is_archived);
}
