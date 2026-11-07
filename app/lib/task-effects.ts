import { isStageName, STAGE_NAMES } from "./stage-logic.ts";
import type { StageName } from "./stage-logic.ts";
import { APP_UTC_OFFSET, dateKey, todayKey } from "./dates.ts";

/**
 * Qué le pasa a las plantas cuando se completa una tarea.
 *
 * Completar una tarea no es sólo tachar un renglón: cosechar significa que la
 * planta se cortó y está secándose, declararla muerta significa que ya no está
 * en el cultivo. Antes esto había que hacerlo a mano después de tildar la
 * tarea, y lo normal era olvidarse. Acá se decide, sin tocar la base, qué
 * cambio corresponde a cada tipo y qué queda en la bitácora; la server action
 * sólo lo aplica.
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

/**
 * Lo que hace completar una tarea, según su tipo. Toda tarea deja un registro
 * en la bitácora de cada planta que alcanza (`logType`), aunque no cambie
 * nada más: una poda también es parte de la historia de la planta.
 */
export interface CompletionPlan {
  /** El tipo con que se escribe el registro en la bitácora. */
  logType: string;
  /** Marca el riego (`last_water`). */
  water: boolean;
  stage: StageEffect | null;
  archive: boolean;
  /** Crea la ficha de cosecha de las plantas que no la tienen. */
  harvest: boolean;
  /** Muda ciclos y plantas al espacio destino ("Cambiar ambiente"). */
  move: boolean;
  /** Anota la mezcla guardada (si la tarea tiene una). */
  feed: boolean;
}

/** La etapa en la que entra una planta al cosecharla. */
export const HARVEST_STAGE: StageName = 'Secado';

interface CompletableTask {
  type?: string | null;
  application_type?: string | null;
  target_stage?: string | null;
}

/** Los tipos que sólo dejan su registro, con su mismo id. */
const LOG_ONLY_TYPES = new Set(['poda', 'trasplante', 'entrenamiento', 'repelente', 'otro']);

/**
 * Qué hace completar la tarea. Null para el esquejado, que se completa desde
 * su propia ventana porque necesita saber cuántos esquejes salieron.
 */
export function getCompletionPlan(task: CompletableTask): CompletionPlan | null {
  const plan: CompletionPlan = {
    logType: 'otro', water: false, stage: null, archive: false, harvest: false, move: false, feed: false,
  };
  switch (task.type) {
    case 'esquejado':
      return null;
    case 'riego':
    case 'lavado':
      return { ...plan, logType: task.type, water: true };
    case 'fertilizante':
      // Sólo cuenta como riego si el fertilizante se aplicó en el agua.
      return { ...plan, logType: 'fertilizante', feed: true, water: task.application_type === 'Riego' };
    case 'cambio_etapa':
      // `target_stage` viene de la base pero lo eligió el cliente: si no es una
      // de las siete etapas no se escribe nada.
      return {
        ...plan,
        logType: 'cambio_etapa',
        stage: isStageName(task.target_stage) ? { kind: 'stage', stage: task.target_stage, onlyForward: false } : null,
      };
    case 'cosechar':
      return { ...plan, logType: 'cosechar', harvest: true, stage: { kind: 'stage', stage: HARVEST_STAGE, onlyForward: true } };
    case 'muerta':
      return { ...plan, logType: 'muerta', archive: true };
    case 'ambiente':
      return { ...plan, logType: 'ambiente', move: true };
    default:
      return { ...plan, logType: task.type && LOG_ONLY_TYPES.has(task.type) ? task.type : 'otro' };
  }
}

/** El título del registro de un cambio de etapa, el mismo a mano o por tarea. */
export function stageLogTitle(stage: string): string {
  return `Cambio de etapa a ${stage}`;
}

/** El título del registro de una mudanza de ciclo. */
export function cycleMoveTitle(from: string, to: string): string {
  return `Mudanza de espacio: ${from} → ${to}`;
}

/** El registro completo de una mudanza de ciclo (va a nivel ciclo, sin planta). */
export function cycleMoveEntry(from: string, to: string): { type: 'ambiente'; title: string; notes: string } {
  return { type: 'ambiente', title: cycleMoveTitle(from, to), notes: `El ciclo pasó de "${from}" a "${to}".` };
}

const LOG_TITLES: Record<string, string> = {
  riego: 'Riego',
  lavado: 'Lavado de raíces',
  fertilizante: 'Fertilizante',
  cosechar: 'Cosecha',
  muerta: 'Declarada muerta',
};

/** El título del registro que deja la tarea: lo que pasó, no lo que había que hacer. */
export function logTitleFor(type: string, taskTitle: string, stage?: string | null): string {
  if (type === 'cambio_etapa' && stage) return stageLogTitle(stage);
  return LOG_TITLES[type] ?? taskTitle;
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

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * La fecha con la que se registra el efecto: el día en que la tarea se hizo,
 * que en una atrasada lo dice quien la completa. Hoy (o sin día) es ahora; un
 * día pasado queda al mediodía de ese día en Argentina. Nunca en el futuro.
 *
 * Antes se usaba el día agendado: un riego atrasado 5 días y hecho hoy dejaba
 * la planta "sin regar hace 5 días".
 */
export function getTaskEffectDate(doneOn: string | null | undefined, now: Date = new Date()): string {
  if (typeof doneOn !== 'string' || !DATE_ONLY.test(doneOn) || doneOn >= todayKey(now)) return now.toISOString();
  const date = new Date(`${doneOn}T12:00:00${APP_UTC_OFFSET}`);
  return isNaN(date.getTime()) ? now.toISOString() : date.toISOString();
}

/** ¿El día agendado ya pasó? Se cuentan días en Argentina. */
export function isOverdue(dueDate: string | null | undefined, now: Date = new Date()): boolean {
  const day = dateKey(dueDate);
  return day !== null && day < todayKey(now);
}

/** Lo que hay que preguntar al completar una tarea antes de aplicarla. */
export interface CompletionNeeds {
  /** Atrasada: qué día se hizo. */
  date: boolean;
  /** Fertilizante con mezcla: litros y stock. */
  feed: boolean;
  /** Cosechar: pesos húmedos, opcionales. */
  harvest: boolean;
  /** Cambiar ambiente: destino o ciclo, si hacen falta. */
  ambiente: boolean;
  /** Cambios grandes que se confirman. */
  confirm: 'muerta' | 'ambiente' | null;
  any: boolean;
}

export function completionNeeds(
  task: { type: string; due_date: string; target_space_id?: number | null },
  hasMix: boolean,
  now: Date = new Date()
): CompletionNeeds {
  const needs = {
    date: isOverdue(task.due_date, now),
    feed: task.type === 'fertilizante' && hasMix,
    harvest: task.type === 'cosechar',
    ambiente: task.type === 'ambiente',
    confirm: task.type === 'muerta' || task.type === 'ambiente' ? task.type : null,
  } as const;
  return { ...needs, any: needs.date || needs.feed || needs.harvest || needs.ambiente || needs.confirm !== null };
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

/**
 * Qué mueve una tarea de "Cambiar ambiente" al completarse.
 *
 * Las plantas no tienen espacio propio: viven en un ciclo y el ciclo en un
 * espacio. Mudar un ciclo elegido entero es mudar el ciclo, y elegir sueltas
 * todas las plantas activas de un ciclo también: es el mismo cultivo cambiando
 * de lugar. Las demás plantas sueltas pasan a un ciclo del espacio destino: el
 * que se eligió al completar o, si no, el único activo. Si no hay ninguno o
 * hay varios, quedan pendientes y la hoja de completar pregunta.
 */
export interface AmbienteMovePlan {
  /** Ciclos a mudar al espacio destino. */
  cycleIds: number[];
  /** Plantas sueltas a pasar a `targetCycleId`. */
  plantIds: number[];
  /** El ciclo del destino que recibe a las plantas sueltas, si lo hay. */
  targetCycleId: number | null;
  /** Plantas sueltas que no se pudieron ubicar. */
  unplacedPlantIds: number[];
}

export function planAmbienteMove(
  targets: TaskTargets,
  targetSpaceId: number,
  /** Las plantas elegidas sueltas, con su ciclo actual. */
  plants: TargetPlant[],
  /** Espacio actual de cada ciclo involucrado (los elegidos y los de las plantas). */
  cycleSpaces: Map<number, number | null>,
  /** Ciclos activos del espacio destino. */
  activeCyclesInTarget: number[],
  /** Las plantas activas de cada ciclo involucrado, hoy. */
  activePlantsByCycle: Map<number, number[]>,
  /** El ciclo del destino elegido al completar. */
  chosenCycleId: number | null = null
): AmbienteMovePlan {
  const chosen = new Set(targets.plant_ids);

  // Ciclos cuyas plantas activas se eligieron todas, una por una.
  const fullCycles = Array.from(activePlantsByCycle.entries())
    .filter(([, ids]) => ids.length > 0 && ids.every((id) => chosen.has(Number(id))))
    .map(([cycleId]) => Number(cycleId));

  const movingCycles = new Set([...targets.cycle_ids, ...fullCycles]);
  const cycleIds = Array.from(movingCycles).filter((id) => cycleSpaces.get(id) !== targetSpaceId);

  const targetCycleId = chosenCycleId != null && activeCyclesInTarget.includes(chosenCycleId)
    ? chosenCycleId
    : activeCyclesInTarget.length === 1 ? activeCyclesInTarget[0] : null;

  const plantIds: number[] = [];
  const unplacedPlantIds: number[] = [];

  for (const plant of plants) {
    const id = Number(plant.id);
    if (!chosen.has(id) || plant.is_archived) continue;

    const cycleId = plant.cycle_id == null ? null : Number(plant.cycle_id);
    // Ya viaja con su ciclo, o ya está en el espacio destino.
    if (cycleId != null && (movingCycles.has(cycleId) || cycleSpaces.get(cycleId) === targetSpaceId)) continue;

    if (targetCycleId != null) plantIds.push(id);
    else unplacedPlantIds.push(id);
  }

  return { cycleIds, plantIds, targetCycleId, unplacedPlantIds };
}

/**
 * ¿La tarea es de esta planta? Para la ficha de la planta.
 *
 * Una tarea de ciclo entero alcanza a todas las plantas que hoy están en el
 * ciclo, aunque hayan entrado después de agendarla; una tarea de una planta
 * suelta, sólo a esa. No alcanza mirar `task_cycles`: una tarea de una planta
 * también enlaza su ciclo (para mostrarlo en la agenda), y aparecería en la
 * ficha de todas las demás. Las tareas viejas, sin `metadata.targets`, se
 * reconocen por la foto de `task_plants`.
 */
export function taskAppliesToPlant(
  task: { metadata?: unknown; task_plants?: { plant_id: number }[] | null },
  plant: { id: number; cycle_id?: number | null }
): boolean {
  const plantId = Number(plant.id);
  const targets = readTaskTargets(task.metadata);
  if (targets) {
    if (targets.plant_ids.includes(plantId)) return true;
    return plant.cycle_id != null && targets.cycle_ids.includes(Number(plant.cycle_id));
  }
  return (task.task_plants ?? []).some((link) => Number(link.plant_id) === plantId);
}
