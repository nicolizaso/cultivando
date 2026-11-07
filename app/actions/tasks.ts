'use server'

import { requireUser } from "@/app/lib/auth"
import type { ServerSupabase } from "@/app/lib/auth"
import { TASK_TYPES, getTaskType } from "@/app/lib/constants"
import { addDaysToKey, dateKey, daysBetweenKeys, todayKey } from "@/app/lib/dates"
import {
  buildFeedLog, buildStoredMix, describeFeed, hasStoredMix, mixLabel, mixRecipe, parseMixInput, readStoredMix,
  resolveMix, stripRecipe, weekInStage, withRecipe,
} from "@/app/lib/nutrition"
import type { MixItem, StoredMix } from "@/app/lib/nutrition"
import { loadMixSources, ownsAll } from "@/app/lib/nutrition-data"
import type { MixSources } from "@/app/lib/nutrition-data"
import { getPlantMetrics } from "@/app/lib/plant-metrics"
import type { PlantDates } from "@/app/lib/plant-metrics"
import { buildOccurrenceDates, isFrequency } from "@/app/lib/recurrence"
import { friendlyDbError } from "@/app/lib/errors"
import { parseDecimal, parseId, parseIds } from "@/app/lib/sanitize"
import { revalidatePath } from "next/cache"
import { randomUUID } from 'crypto'
import { mapTaskCycles } from "../lib/utils"
import {
  buildClonePlants,
  sanitizeCloneEntries,
  totalClones,
  validateCloneEntries,
} from "../lib/clones"
import type { CloneEntry, CloneMother } from "../lib/clones"
import type { EsquejadoMetadata, Task, TaskMetadata } from "../lib/types"
import type { Json } from "../lib/database.types"
import { STAGE_DATE_COLUMNS, getStageDateColumn, isStageName } from "../lib/stage-logic"
import {
  cycleMoveEntry,
  getCompletionPlan,
  getTaskEffectDate,
  inferLegacyTargets,
  logTitleFor,
  planAmbienteMove,
  readTaskTargets,
  resolveTaskPlants,
  shouldApplyStage,
} from "../lib/task-effects"
import type { AmbienteMovePlan, TargetPlant, TaskTargets } from "../lib/task-effects"
import { groupByValue, hasUndoableChanges, readLastEffect } from "../lib/task-undo"
import type { LastEffect } from "../lib/task-undo"
import { describeCompletion, describeReopen } from "../lib/task-outcome"
import type { CompletionOutcome } from "../lib/task-outcome"
import {
  setCycleSpace, setPlantsArchived, setPlantsCycle, setPlantsStage, setPlantsWatered, writeCycleLog, writePlantLogs,
} from "../lib/plant-writes"
import type { LogEntry, PlantRef } from "../lib/plant-writes"
import { parseHarvestInput } from "../lib/harvest"

/** Las siete columnas de fecha de etapa, para pedirlas en un select. */
const STAGE_DATE_SELECT = Object.values(STAGE_DATE_COLUMNS).join(', ')
const STAGE_DATE_COLUMN_SET = new Set<string>(Object.values(STAGE_DATE_COLUMNS))

type TargetKind = 'plant' | 'cycle' | 'space'

const APPLICATION_TYPES = ['Riego', 'Foliar', 'Directo al Sustrato'] as const
const TASK_TYPE_IDS = new Set(TASK_TYPES.map((type) => type.id))
const DATE_INPUT = /^\d{4}-\d{2}-\d{2}/

/** El día ("YYYY-MM-DD") de lo que manda el formulario, con o sin hora. */
function readDay(value: unknown): string | null {
  if (typeof value !== 'string' || !DATE_INPUT.test(value)) return null
  return value.slice(0, 10)
}

function readTargets(value: unknown): { kind: TargetKind; id: number }[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const targets: { kind: TargetKind; id: number }[] = []
  for (const item of value) {
    const kind = (item as { type?: unknown })?.type
    const id = parseId((item as { id?: unknown })?.id)
    if ((kind !== 'plant' && kind !== 'cycle' && kind !== 'space') || !id) continue
    const key = `${kind}-${id}`
    if (seen.has(key)) continue
    seen.add(key)
    targets.push({ kind, id })
  }
  return targets
}

/**
 * Lee la mezcla del formulario y la valida contra los productos del usuario.
 * `undefined` = no vino (no se toca), `null` = sin mezcla.
 */
async function readMix(
  supabase: ServerSupabase,
  userId: string,
  value: unknown
): Promise<{ mix: { items: MixItem[]; stage_days: number } | null; sources: MixSources | null } | { error: string }> {
  const input = parseMixInput(value)
  if (input === 'invalid') return { error: 'Revisá los fertilizantes: hay algo que no se entiende.' }
  if (!input) return { mix: null, sources: null }
  const sources = await loadMixSources(supabase, userId)
  if ('error' in sources) return { error: sources.error }
  if (!ownsAll(input.items, sources.fertilizers)) return { error: 'Alguno de los productos ya no existe.' }
  return { mix: input, sources }
}

/** Los detalles de una tarea de fertilizante: la receta arriba y las notas abajo. */
function describeWithMix(notes: string, mix: StoredMix | null): string | null {
  return (mix ? withRecipe(notes, mixRecipe(mix.resolved, mix.week)) : notes) || null
}

/**
 * Agenda una tarea o una serie.
 *
 * Todo lo que llega del formulario se valida acá: el tipo tiene que existir,
 * el título de las tareas comunes sale de la taxonomía (no del cliente) y los
 * objetivos se resuelven contra la base. Las tareas y sus relaciones se
 * guardan juntas en `create_tasks`: o se crea todo, o nada.
 */
export async function createTask(input: unknown) {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase, user } = session

  const form = (input ?? {}) as Record<string, unknown>
  const targets = readTargets(form.targets)
  if (targets.length === 0) return { error: 'Elegí al menos una planta, ciclo o espacio.' }

  const typeId = (form.taskType as { id?: unknown } | undefined)?.id
  if (typeof typeId !== 'string' || !TASK_TYPE_IDS.has(typeId)) return { error: 'Elegí un tipo de tarea.' }
  const taskType = getTaskType(typeId)

  const otherText = typeof form.otherText === 'string' ? form.otherText.trim().slice(0, 120) : ''
  const title = taskType.id === 'otro' ? otherText : taskType.label
  if (!title) return { error: 'Falta el título.' }

  const startDay = readDay(form.date)
  if (!startDay) return { error: 'La fecha no es válida.' }

  const isRecurring = form.isRecurring === true
  const frequency = isFrequency(form.frequency) ? form.frequency : 'daily'
  const endDay = isRecurring ? readDay(form.endDate) : null
  if (isRecurring && !endDay) return { error: 'Elegí una fecha de fin para la repetición.' }

  const description = typeof form.description === 'string' ? form.description.trim().slice(0, 2000) : ''
  const applicationType = APPLICATION_TYPES.find((value) => value === form.applicationType) ?? 'Riego'
  const targetStage = isStageName(form.targetStage) ? form.targetStage : null
  const targetSpaceId = parseId(form.targetSpaceId)

  if (taskType.id === 'cambio_etapa' && !targetStage) return { error: 'Elegí la etapa de destino.' }
  if (taskType.id === 'ambiente' && !targetSpaceId) return { error: 'Elegí el espacio de destino.' }

  // 1. Objetivos → ciclos y plantas. Tres consultas en total, no una por objetivo.
  const plantTargetIds = targets.filter((t) => t.kind === 'plant').map((t) => t.id)
  const cycleTargetIds = targets.filter((t) => t.kind === 'cycle').map((t) => t.id)
  const spaceTargetIds = targets.filter((t) => t.kind === 'space').map((t) => t.id)

  const [plantRows, spaceCycles] = await Promise.all([
    plantTargetIds.length > 0
      ? supabase.from('plants').select('id, cycle_id').in('id', plantTargetIds)
      : Promise.resolve({ data: [] as { id: number; cycle_id: number | null }[], error: null }),
    spaceTargetIds.length > 0
      ? supabase.from('cycles').select('id, space_id').in('space_id', spaceTargetIds).eq('is_active', true)
      : Promise.resolve({ data: [] as { id: number; space_id: number | null }[], error: null }),
  ])

  if (plantRows.error || spaceCycles.error) {
    return { error: friendlyDbError(plantRows.error ?? spaceCycles.error, 'No se pudieron leer los objetivos.', {}, 'Error resolviendo objetivos de la tarea:') }
  }

  // Lo que se eligió de verdad, para que al completarla la tarea alcance a las
  // plantas que el ciclo tenga ese día y no a las que tenía al agendarla.
  const wholeCycleIds = Array.from(new Set([...cycleTargetIds, ...(spaceCycles.data ?? []).map((cycle) => Number(cycle.id))]))

  const { data: cyclePlants, error: cyclePlantsError } = wholeCycleIds.length > 0
    ? await supabase.from('plants').select('id, cycle_id').in('cycle_id', wholeCycleIds)
    : { data: [] as { id: number; cycle_id: number | null }[], error: null }

  if (cyclePlantsError) {
    return { error: friendlyDbError(cyclePlantsError, 'No se pudieron leer las plantas de los ciclos.', {}, 'Error leyendo plantas de los ciclos:') }
  }

  const foundPlants = (plantRows.data ?? []) as { id: number; cycle_id: number | null }[]
  const linkedCycleIds = Array.from(new Set([
    ...wholeCycleIds,
    // Una planta suelta también enlaza su ciclo, para mostrarlo en la agenda.
    ...foundPlants.map((plant) => plant.cycle_id).filter((id): id is number => id != null).map(Number),
  ]))
  const linkedPlantIds = Array.from(new Set([
    ...foundPlants.map((plant) => Number(plant.id)),
    ...((cyclePlants ?? []) as { id: number }[]).map((plant) => Number(plant.id)),
  ]))

  const taskTargets: TaskTargets = {
    cycle_ids: wholeCycleIds,
    plant_ids: foundPlants.map((plant) => Number(plant.id)),
  }

  // 2. Fechas de la serie.
  const { dates, truncated } = isRecurring
    ? buildOccurrenceDates(startDay, endDay, frequency)
    : { dates: [startDay], truncated: false }
  if (dates.length === 0) return { error: 'La fecha no es válida.' }

  // 3. La mezcla, si es un fertilizante con productos. La receta se arma para
  // cada fecha: en una serie la semana de la etapa avanza y la dosis también.
  const mixResult = taskType.id === 'fertilizante' ? await readMix(supabase, user.id, form.nutrition) : { mix: null, sources: null }
  if ('error' in mixResult) return { error: mixResult.error }
  const { mix, sources } = mixResult

  const recurrenceId = isRecurring && dates.length > 1 ? randomUUID() : null

  const rows = dates.map((day) => {
    const stored = mix && sources
      ? buildStoredMix(mix.items, sources.fertilizers, sources.combos, mix.stage_days + Math.max(0, daysBetweenKeys(startDay, day)))
      : null
    return {
      title,
      description: describeWithMix(description, stored),
      // Mediodía: una fecha sin hora a las 00:00 se corre al día anterior
      // al oeste de Greenwich.
      due_date: `${day}T12:00:00`,
      type: taskType.id,
      application_type: taskType.id === 'fertilizante' ? applicationType : null,
      target_stage: taskType.id === 'cambio_etapa' ? targetStage : null,
      target_space_id: taskType.id === 'ambiente' ? targetSpaceId : null,
      recurrence_id: recurrenceId,
      metadata: {
        targets: taskTargets,
        ...(stored ? { nutrition: stored } : {}),
      },
    }
  })

  const { error } = await supabase.rpc('create_tasks', {
    p_tasks: rows as unknown as Json,
    p_cycle_ids: linkedCycleIds,
    p_plant_ids: linkedPlantIds,
  })

  if (error) return { error: friendlyDbError(error, 'No se pudo agendar la tarea.', {}, 'Error creando tareas:') }

  revalidatePath('/')
  revalidatePath('/calendar')
  return { success: true, created: rows.length, truncated }
}

/**
 * Edita una tarea, o "esta y las siguientes" de una serie.
 *
 * En una tarea de fertilizante llega la mezcla como datos y los detalles sin
 * la receta: la receta se arma acá. En una serie, cada tarea corre su fecha
 * los mismos días que la elegida y recalcula la dosis con su propia semana;
 * todo se escribe junto con `update_task_series_rows`. Antes se copiaba la
 * descripción de la elegida a todas, receta incluida, y todas quedaban con la
 * dosis de la misma semana.
 */
export async function updateTask(
  rawTaskId: string | number,
  rawUpdates: unknown,
  scope: 'single' | 'all_future' = 'single',
  _recurrenceId?: string | null
) {
  void _recurrenceId
  const taskId = parseId(rawTaskId)
  if (!taskId) return { error: 'Esa tarea no es válida.' }

  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase, user } = session

  const updates = (rawUpdates ?? {}) as Record<string, unknown>
  const title = typeof updates.title === 'string' ? updates.title.trim().slice(0, 120) : ''
  if (!title) return { error: 'El título es obligatorio.' }

  const notes = typeof updates.description === 'string' ? updates.description.trim().slice(0, 2000) : ''
  const day = readDay(updates.date)
  if (!day) return { error: 'La fecha no es válida.' }

  const applicationType = updates.application_type == null
    ? null
    : APPLICATION_TYPES.find((value) => value === updates.application_type) ?? null
  if (updates.application_type != null && !applicationType) return { error: 'Elegí cómo se aplica.' }

  const targetStage = updates.target_stage == null ? null : isStageName(updates.target_stage) ? updates.target_stage : null
  if (updates.target_stage != null && !targetStage) return { error: 'Elegí la etapa de destino.' }

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, type, due_date, recurrence_id, metadata')
    .eq('id', taskId)
    .maybeSingle()
  if (taskError || !task) return { error: friendlyDbError(taskError, 'No se encontró la tarea.', {}, 'Error leyendo la tarea:') }

  // La mezcla sólo se toca si vino en el formulario y la tarea es de fertilizante.
  const touchesMix = task.type === 'fertilizante' && Object.prototype.hasOwnProperty.call(updates, 'nutrition')
  const mixResult = touchesMix ? await readMix(supabase, user.id, updates.nutrition) : { mix: null, sources: null }
  if ('error' in mixResult) return { error: mixResult.error }
  const { mix, sources } = mixResult
  const storedFor = (stageDays: number) =>
    mix && sources ? buildStoredMix(mix.items, sources.fertilizers, sources.combos, stageDays) : null

  if (scope === 'all_future' && task.recurrence_id) {
    const oldDay = dateKey(task.due_date)
    if (!oldDay) return { error: 'La fecha de la tarea no es válida.' }
    const shift = daysBetweenKeys(oldDay, day)

    const { data: series, error: seriesError } = await supabase
      .from('tasks')
      .select('id, due_date')
      .eq('recurrence_id', task.recurrence_id)
      .gte('due_date', task.due_date)
      .order('due_date', { ascending: true })
    if (seriesError) return { error: friendlyDbError(seriesError, 'No se pudo leer la serie.', {}, 'Error leyendo la serie:') }

    const rows = (series ?? []).flatMap((row) => {
      const rowDay = dateKey(row.due_date)
      if (!rowDay) return []
      const newDay = addDaysToKey(rowDay, shift)
      const stored = touchesMix && mix ? storedFor(mix.stage_days + Math.max(0, daysBetweenKeys(day, newDay))) : null
      return [{
        id: Number(row.id),
        due_date: `${newDay}T12:00:00`,
        description: touchesMix ? describeWithMix(notes, stored) : notes || null,
        ...(touchesMix ? { nutrition: stored } : {}),
      }]
    })

    const { error } = await supabase.rpc('update_task_series_rows', {
      p_task_id: taskId,
      p_title: title,
      p_application_type: applicationType,
      p_target_stage: targetStage,
      p_rows: rows as unknown as Json,
    })

    if (error) {
      return {
        error: friendlyDbError(error, 'No se pudo actualizar la serie.', {
          P0002: 'No se encontró la tarea.',
          '22023': 'La tarea no es parte de una serie.',
        }, 'Error actualizando la serie:'),
      }
    }
  } else {
    const stored = touchesMix && mix ? storedFor(mix.stage_days) : null
    const metadata = { ...((task.metadata as Record<string, unknown> | null) ?? {}) }
    delete metadata.nutrition
    if (stored) metadata.nutrition = stored

    const { error } = await supabase
      .from('tasks')
      .update({
        title,
        description: touchesMix ? describeWithMix(notes, stored) : notes || null,
        application_type: applicationType,
        target_stage: targetStage,
        // Mediodía: una fecha sin hora a las 00:00 se corre al día anterior.
        due_date: `${day}T12:00:00`,
        ...(touchesMix ? { metadata: metadata as Json } : {}),
      })
      .eq('id', taskId)

    if (error) return { error: friendlyDbError(error, 'No se pudo actualizar la tarea.', {}, 'Error actualizando tarea:') }
  }

  revalidatePath('/')
  revalidatePath('/calendar')
  return { success: true }
}

export async function deleteTasks(taskIds: (string | number)[]) {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase } = session

  const ids = parseIds(taskIds)
  if (ids.length === 0) return { error: 'No hay tareas seleccionadas.' }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .in('id', ids)

  if (error) return { error: friendlyDbError(error, 'No se pudieron eliminar las tareas.', {}, 'Error eliminando tareas:') }

  revalidatePath('/')
  revalidatePath('/calendar')
  return { success: true }
}

const TASK_WITH_TARGETS = `
  id, type, title, description, status, due_date, application_type, target_stage, target_space_id, metadata,
  task_plants ( plant_id, plants ( id, cycle_id, stage, is_archived ) ),
  task_cycles ( cycle_id )
`

type TaskWithTargets = {
  metadata?: unknown
  task_plants?: { plant_id: number; plants?: TargetPlant | null }[] | null
  task_cycles?: { cycle_id: number }[] | null
}

/** Una planta alcanzada por la tarea, con lo necesario para aplicar y deshacer. */
type EffectPlant = TargetPlant & {
  name?: string
  strain?: string | null
  breeder?: string | null
  cycle_id: number | null
  last_water?: string | null
  stage_updated_at?: string | null
} & Partial<Record<string, unknown>>

/** Lo que eligió la tarea: `metadata.targets`, o lo deducido si es vieja. */
function getTaskTargets(task: TaskWithTargets): TaskTargets {
  const linked = (task.task_plants ?? [])
    .map((tp) => tp.plants)
    .filter((plant): plant is TargetPlant => Boolean(plant))
  const taskCycleIds = (task.task_cycles ?? []).map((tc) => Number(tc.cycle_id)).filter(Boolean)

  return readTaskTargets(task.metadata) ?? inferLegacyTargets(linked, taskCycleIds)
}

/**
 * Las plantas a las que alcanza la tarea hoy: las elegidas una por una y las
 * que están ahora en sus ciclos. Una planta que entró al ciclo después de
 * agendar la tarea también cuenta, y una que se fue a otro ciclo ya no. Las
 * archivadas quedan afuera.
 */
async function loadTaskPlants(supabase: ServerSupabase, task: TaskWithTargets): Promise<EffectPlant[]> {
  const targets = getTaskTargets(task)

  // Con lo que hace falta para deshacer: riego, fecha de etapa y las siete fechas.
  const columns = `id, name, strain, breeder, cycle_id, stage, is_archived, last_water, stage_updated_at, ${STAGE_DATE_SELECT}`
  const [byPlant, byCycle] = await Promise.all([
    targets.plant_ids.length > 0
      ? supabase.from('plants').select(columns).in('id', targets.plant_ids)
      : Promise.resolve({ data: [] as EffectPlant[], error: null }),
    targets.cycle_ids.length > 0
      ? supabase.from('plants').select(columns).in('cycle_id', targets.cycle_ids)
      : Promise.resolve({ data: [] as EffectPlant[], error: null }),
  ])

  if (byPlant.error) console.error('Error leyendo las plantas de la tarea:', byPlant.error)
  if (byCycle.error) console.error('Error leyendo las plantas de los ciclos de la tarea:', byCycle.error)

  return resolveTaskPlants(
    targets,
    (byPlant.data ?? []) as unknown as EffectPlant[],
    (byCycle.data ?? []) as unknown as EffectPlant[]
  ) as EffectPlant[]
}

function withoutLastEffect(metadata: unknown): Record<string, unknown> {
  const copy = { ...((metadata as Record<string, unknown> | null) ?? {}) }
  delete copy.last_effect
  return copy
}

function revalidateTaskViews(stock = false) {
  revalidatePath('/')
  revalidatePath('/calendar')
  revalidatePath('/plants')
  revalidatePath('/plants/[id]', 'page')
  revalidatePath('/cycles')
  revalidatePath('/cycles/[id]', 'page')
  revalidatePath('/spaces')
  revalidatePath('/strains')
  if (stock) revalidatePath('/fertilizers')
}

/* --------------------------------------------------------------------------
 * Mudanzas ("Cambiar ambiente")
 * ----------------------------------------------------------------------- */

interface MovePreview {
  plan: AmbienteMovePlan
  spaceName: string
  /** Nombre y espacio de cada ciclo involucrado, para la bitácora. */
  cycles: Map<number, { name: string; space_id: number | null; spaceName: string }>
  /** Las plantas elegidas sueltas, con su ciclo actual. */
  plants: TargetPlant[]
  /** Los ciclos activos del destino. */
  activeInTarget: { id: number; name: string }[]
}

/** Lo que movería la tarea a `targetSpaceId`, sin escribir nada. */
async function previewMove(
  supabase: ServerSupabase,
  task: TaskWithTargets,
  targetSpaceId: number,
  chosenCycleId: number | null
): Promise<MovePreview | null> {
  const targets = getTaskTargets(task)

  const [spaceResult, plantsResult, activeResult] = await Promise.all([
    supabase.from('spaces').select('id, name').eq('id', targetSpaceId).maybeSingle(),
    targets.plant_ids.length > 0
      ? supabase.from('plants').select('id, cycle_id, is_archived').in('id', targets.plant_ids)
      : Promise.resolve({ data: [] as TargetPlant[], error: null }),
    supabase.from('cycles').select('id, name').eq('space_id', targetSpaceId).eq('is_active', true).order('name'),
  ])

  if (spaceResult.error || !spaceResult.data) {
    console.error('No se encontró el espacio destino de la tarea:', spaceResult.error)
    return null
  }

  const plants = (plantsResult.data ?? []) as TargetPlant[]
  const involvedIds = Array.from(new Set([
    ...targets.cycle_ids,
    ...plants.map((plant) => Number(plant.cycle_id)).filter(Boolean),
  ]))

  const [cyclesResult, activePlantsResult] = involvedIds.length > 0
    ? await Promise.all([
        supabase.from('cycles').select('id, name, space_id, spaces ( name )').in('id', involvedIds),
        supabase.from('plants').select('id, cycle_id').in('cycle_id', involvedIds).or('is_archived.is.null,is_archived.eq.false'),
      ])
    : [{ data: [] }, { data: [] }]

  const cycles = new Map<number, { name: string; space_id: number | null; spaceName: string }>()
  for (const cycle of (cyclesResult.data ?? []) as { id: number; name: string; space_id: number | null; spaces: { name: string } | { name: string }[] | null }[]) {
    const space = Array.isArray(cycle.spaces) ? cycle.spaces[0] : cycle.spaces
    cycles.set(Number(cycle.id), {
      name: cycle.name,
      space_id: cycle.space_id == null ? null : Number(cycle.space_id),
      spaceName: space?.name || 'Sin espacio',
    })
  }

  const activePlantsByCycle = new Map<number, number[]>()
  for (const plant of (activePlantsResult.data ?? []) as { id: number; cycle_id: number | null }[]) {
    if (plant.cycle_id == null) continue
    const list = activePlantsByCycle.get(Number(plant.cycle_id)) ?? []
    list.push(Number(plant.id))
    activePlantsByCycle.set(Number(plant.cycle_id), list)
  }

  const activeInTarget = ((activeResult.data ?? []) as { id: number; name: string }[]).map((cycle) => ({ id: Number(cycle.id), name: cycle.name }))
  const plan = planAmbienteMove(
    // Un ciclo que ya no existe no se puede mudar.
    { ...targets, cycle_ids: targets.cycle_ids.filter((id) => cycles.has(id)) },
    targetSpaceId,
    plants,
    new Map(Array.from(cycles.entries()).map(([id, cycle]) => [id, cycle.space_id])),
    activeInTarget.map((cycle) => cycle.id),
    activePlantsByCycle,
    chosenCycleId
  )

  return { plan, spaceName: spaceResult.data.name, cycles, plants, activeInTarget }
}

/**
 * Muda lo que dice el plan (ver `planAmbienteMove`). Si quedan plantas sin
 * ciclo en el destino y se pidió uno nuevo, lo crea. Cada ciclo mudado deja
 * un registro a nivel ciclo y cada planta pasada de ciclo, el suyo.
 */
async function applyMove(
  supabase: ServerSupabase,
  userId: string,
  task: TaskWithTargets & { id: number },
  targetSpaceId: number,
  choice: { cycleId: number | null; newCycleName: string },
  effectDate: string,
  notes: string | null,
  before: LastEffect,
  problems: string[]
): Promise<{ move: NonNullable<CompletionOutcome['move']>; logs: number } | null> {
  let preview = await previewMove(supabase, task, targetSpaceId, choice.cycleId)
  if (!preview) {
    problems.push('No se encontró el espacio de destino.')
    return null
  }

  if (preview.plan.unplacedPlantIds.length > 0 && choice.newCycleName) {
    const { data: created, error } = await supabase
      .from('cycles')
      .insert({ name: choice.newCycleName, start_date: dateKey(effectDate), space_id: targetSpaceId, is_active: true, user_id: userId })
      .select('id')
      .single()
    if (error || !created) {
      console.error('No se pudo crear el ciclo del destino:', error)
      problems.push('No se pudo crear el ciclo nuevo.')
    } else {
      before.createdCycle = Number(created.id)
      preview = (await previewMove(supabase, task, targetSpaceId, Number(created.id))) ?? preview
    }
  }

  const { plan, spaceName, cycles, plants } = preview
  let logs = 0

  const movedCycles: { id: number; space_id: number | null; to: number }[] = []
  for (const cycleId of plan.cycleIds) {
    const cycle = cycles.get(cycleId)
    const { error } = await setCycleSpace(supabase, cycleId, targetSpaceId)
    if (error) {
      console.error(`No se pudo mudar el ciclo ${cycleId}:`, error)
      problems.push(`No se pudo mudar ${cycle?.name ?? 'un ciclo'}.`)
      continue
    }
    movedCycles.push({ id: cycleId, space_id: cycle?.space_id ?? null, to: targetSpaceId })
    const entry = cycleMoveEntry(cycle?.spaceName ?? 'Sin espacio', spaceName)
    const logId = await writeCycleLog(supabase, userId, cycleId, { ...entry, notes: [entry.notes, notes].filter(Boolean).join('\n') }, effectDate, task.id)
    if (logId) {
      before.logs = [...(before.logs ?? []), logId]
      logs++
    }
  }
  if (movedCycles.length > 0) before.cycles = movedCycles

  let movedPlants = 0
  if (plan.targetCycleId != null && plan.plantIds.length > 0) {
    const { error } = await setPlantsCycle(supabase, plan.plantIds, plan.targetCycleId)
    if (error) {
      console.error('No se pudieron pasar las plantas al ciclo del espacio:', error)
      problems.push('No se pudieron pasar las plantas al ciclo del destino.')
    } else {
      movedPlants = plan.plantIds.length
      const previous = new Map(plants.map((plant) => [Number(plant.id), plant.cycle_id == null ? null : Number(plant.cycle_id)]))
      before.plants = plan.plantIds.map((id) => ({ id, cycle_id: previous.get(id) ?? null, to: plan.targetCycleId }))
      const cycleName = preview.activeInTarget.find((cycle) => cycle.id === plan.targetCycleId)?.name ?? choice.newCycleName
      const ids = await writePlantLogs(
        supabase,
        userId,
        plan.plantIds.map((id) => ({ id, cycle_id: plan.targetCycleId })),
        { type: 'ambiente', title: `Movida a ${cycleName} (${spaceName})`, notes },
        effectDate,
        task.id
      )
      before.logs = [...(before.logs ?? []), ...ids]
      logs += ids.length
      if (ids.length < movedPlants) problems.push('No se pudo escribir la bitácora.')
    }
  }

  return { move: { spaceName, cycles: movedCycles.length, plants: movedPlants, unplaced: plan.unplacedPlantIds.length }, logs }
}

/* --------------------------------------------------------------------------
 * Completar
 * ----------------------------------------------------------------------- */

/** Lo que se pregunta al completar (todo opcional). */
export interface CompleteTaskInput {
  /** El día en que se hizo ("YYYY-MM-DD"); sin él, hoy. */
  doneOn?: string | null
  /** Fertilizante: litros preparados y si se descuenta del stock. */
  liters?: string
  deductStock?: boolean
  /** Cosechar: peso húmedo en gramos por id de planta. */
  weights?: Record<string, string>
  /** Declarar muerta: el motivo. */
  note?: string
  /** Cambiar ambiente: destino (si la tarea no tiene) y ciclo del destino. */
  spaceId?: number | null
  cycleId?: number | null
  newCycleName?: string
}

type CompleteResult =
  | { error: string }
  | { success: true; message: string; tone: 'success' | 'error'; canUndo: boolean }

const LOG_PROBLEM = 'No se pudo escribir la bitácora.'

const ALREADY_DONE = { success: true as const, message: 'La tarea ya estaba completada.', tone: 'success' as const, canUndo: false }

/**
 * Completa una tarea y aplica lo que hace su tipo (ver `getCompletionPlan`):
 * etapa, riego, archivado, ficha de cosecha, mudanza o mezcla, y siempre un
 * registro en la bitácora de cada planta, con el id de la tarea. Todo queda
 * fechado el día en que se hizo y anotado en `metadata.last_effect` para
 * poder deshacerlo (`reopenTask`).
 *
 * El cambio de estado es condicional: con un doble toque, o dos pestañas, una
 * sola de las llamadas aplica los efectos. Si un paso falla, la tarea queda
 * completada (sí se hizo) y el aviso dice qué falló.
 */
export async function completeTask(rawTaskId: string | number, rawInput?: CompleteTaskInput): Promise<CompleteResult> {
  const taskId = parseId(rawTaskId)
  if (!taskId) return { error: 'Esa tarea no es válida.' }

  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase, user } = session
  const input = (rawInput ?? {}) as Record<string, unknown>

  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select(TASK_WITH_TARGETS)
    .eq('id', taskId)
    .maybeSingle()
  if (fetchError || !task) return { error: friendlyDbError(fetchError, 'No se encontró la tarea.', {}, 'Error leyendo la tarea:') }
  if (task.status === 'completed') return ALREADY_DONE

  const plan = getCompletionPlan(task)
  if (!plan) return { error: 'Completá el esquejado desde su ventana.' }
  if (task.type === 'cambio_etapa' && !plan.stage) return { error: 'Elegí la etapa de destino desde Editar.' }

  // El día en que se hizo: hoy, o el que se eligió (nunca después de hoy).
  let doneOn: string | null = null
  if (input.doneOn != null && input.doneOn !== '') {
    doneOn = readDay(input.doneOn)
    if (!doneOn) return { error: 'El día no es válido.' }
    if (doneOn > todayKey()) return { error: 'El día no puede ser después de hoy.' }
  }
  const effectDate = getTaskEffectDate(doneOn)
  const effectDay = dateKey(effectDate) ?? todayKey()

  // Mudanza: sin destino no se completa.
  let targetSpaceId = task.target_space_id ? Number(task.target_space_id) : null
  if (plan.move && !targetSpaceId) {
    const chosen = parseId(input.spaceId)
    if (!chosen) return { error: 'Elegí a qué espacio se muda.' }
    const { data: space } = await supabase.from('spaces').select('id').eq('id', chosen).maybeSingle()
    if (!space) return { error: 'No se encontró el espacio de destino.' }
    targetSpaceId = chosen
  }

  // Cosecha: pesos húmedos opcionales, validados antes de escribir nada.
  const weights = new Map<number, number>()
  if (plan.harvest && input.weights && typeof input.weights === 'object') {
    for (const [key, value] of Object.entries(input.weights as Record<string, unknown>)) {
      const plantId = parseId(key)
      if (!plantId || value === '' || value == null) continue
      const parsed = parseHarvestInput({ harvested_on: effectDay, wet_g: value })
      if (parsed.error !== null) return { error: parsed.error }
      if (parsed.data.wet_g !== null) weights.set(plantId, parsed.data.wet_g)
    }
  }

  const metadata = withoutLastEffect(task.metadata)
  const { data: changed, error } = await supabase
    .from('tasks')
    .update({
      status: 'completed',
      completed_at: effectDate,
      metadata: metadata as Json,
      ...(targetSpaceId !== (task.target_space_id ?? null) ? { target_space_id: targetSpaceId } : {}),
    })
    .eq('id', taskId)
    .eq('status', 'pending')
    .select('id')

  if (error) return { error: friendlyDbError(error, 'No se pudo completar la tarea.', {}, 'Error completando la tarea:') }
  // Otra llamada la completó primero: los efectos ya los aplicó ella.
  if (!changed || changed.length === 0) return ALREADY_DONE

  const before: LastEffect = { at: new Date().toISOString() }
  const plants = await loadTaskPlants(supabase, task)
  const outcome: CompletionOutcome = { plants: plants.length, water: 0, archived: 0, harvests: 0, logs: 0, problems: [] }
  const ids = plants.map((plant) => plant.id)

  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 500) : ''
  const description = task.type === 'fertilizante' && hasStoredMix(task.metadata) ? stripRecipe(task.description) : task.description ?? ''
  const notes = [description.trim(), note ? `Motivo: ${note}` : ''].filter(Boolean).join('\n') || null
  const title = logTitleFor(plan.logType, task.title, plan.stage?.stage)

  const log = async (targets: PlantRef[], entry: LogEntry) => {
    const written = await writePlantLogs(supabase, user.id, targets, entry, effectDate, taskId)
    before.logs = [...(before.logs ?? []), ...written]
    outcome.logs += written.length
    if (written.length < targets.length && !outcome.problems.includes(LOG_PROBLEM)) outcome.problems.push(LOG_PROBLEM)
  }

  // 1. Etapa: sólo las que no están ya ahí (o más adelante, si sólo avanza).
  if (plan.stage && plants.length > 0) {
    const stage = plan.stage.stage
    const changing = plants.filter((plant) => shouldApplyStage(plant.stage, plan.stage!))
    const column = getStageDateColumn(stage)!
    outcome.stage = { stage, changed: 0 }
    if (changing.length > 0) {
      const { error: stageError } = await setPlantsStage(supabase, changing.map((plant) => plant.id), stage, effectDate)
      if (stageError) {
        console.error('Error cambiando la etapa al completar la tarea:', stageError)
        outcome.problems.push('No se pudo cambiar la etapa.')
      } else {
        outcome.stage.changed = changing.length
        before.stage = {
          column,
          plants: changing.map((plant) => ({
            id: plant.id,
            stage: plant.stage ?? null,
            stage_updated_at: plant.stage_updated_at ?? null,
            date: (plant[column] as string | null | undefined) ?? null,
          })),
          set: { stage, at: effectDate },
        }
        // El registro del cambio de etapa, sólo en las que cambiaron.
        if (task.type === 'cambio_etapa') await log(changing, { type: plan.logType, title, notes })
      }
    }
  }

  // 2. Riego.
  if (plan.water && ids.length > 0) {
    const { error: waterError } = await setPlantsWatered(supabase, ids, effectDay)
    if (waterError) {
      console.error('Error anotando el riego al completar la tarea:', waterError)
      outcome.problems.push('No se pudo anotar el riego.')
    } else {
      before.water = plants.map((plant) => ({ id: plant.id, last_water: plant.last_water ?? null }))
      before.waterSet = effectDay
      outcome.water = ids.length
    }
  }

  // 3. Archivado: `loadTaskPlants` ya dejó afuera las archivadas.
  if (plan.archive && ids.length > 0) {
    const { error: archiveError } = await setPlantsArchived(supabase, ids, true)
    if (archiveError) {
      console.error('Error archivando plantas al completar la tarea:', archiveError)
      outcome.problems.push('No se pudieron archivar las plantas.')
    } else {
      before.archived = ids
      outcome.archived = ids.length
    }
  }

  // 4. Ficha de cosecha, sólo para las que no tienen una.
  if (plan.harvest && ids.length > 0) {
    const { data: existing } = await supabase.from('harvests').select('plant_id').in('plant_id', ids)
    const already = new Set((existing ?? []).map((row) => Number(row.plant_id)))
    const rows = plants.filter((plant) => !already.has(plant.id)).map((plant) => ({
      plant_id: plant.id,
      cycle_id: plant.cycle_id ?? null,
      harvested_on: effectDay,
      wet_g: weights.get(plant.id) ?? null,
    }))
    if (rows.length > 0) {
      const { error: harvestError } = await supabase.from('harvests').insert(rows)
      if (harvestError) {
        console.error('Error creando las fichas de cosecha:', harvestError)
        outcome.problems.push('No se pudo crear la ficha de cosecha.')
      } else {
        before.harvests = rows.map((row) => row.plant_id)
        outcome.harvests = rows.length
      }
    }
  }

  // 5. Mudanza.
  if (plan.move && targetSpaceId) {
    const moved = await applyMove(
      supabase,
      user.id,
      { ...task, id: taskId },
      targetSpaceId,
      { cycleId: parseId(input.cycleId), newCycleName: typeof input.newCycleName === 'string' ? input.newCycleName.trim().slice(0, 80) : '' },
      effectDate,
      notes,
      before,
      outcome.problems
    )
    if (moved) {
      outcome.move = moved.move
      outcome.logs += moved.logs
    }
  }

  // 6. La mezcla de un fertilizante, con su propio registro (y el stock).
  let feedLogged = false
  if (plan.feed && hasStoredMix(task.metadata) && plants.length > 0) {
    const feed = await applyFeed(supabase, user.id, { id: taskId, metadata: task.metadata }, plants, input, effectDate, before)
    if (feed) {
      feedLogged = true
      outcome.feed = { plants: feed.plants, lowStock: feed.lowStock }
      outcome.logs += feed.plants
    } else {
      outcome.problems.push('No se pudo anotar la mezcla.')
    }
  }

  // 7. El registro de todo lo demás: uno por planta alcanzada.
  if (!plan.move && task.type !== 'cambio_etapa' && !feedLogged && plants.length > 0) {
    if (plan.harvest && weights.size > 0) {
      for (const plant of plants) {
        const grams = weights.get(plant.id)
        const withWeight = grams != null ? [notes, `Peso húmedo: ${grams.toLocaleString('es-AR')} g`].filter(Boolean).join('\n') : notes
        await log([plant], { type: plan.logType, title, notes: withWeight })
      }
    } else {
      await log(plants, { type: plan.logType, title, notes })
    }
  }

  if (hasUndoableChanges(before)) {
    const { error: metaError } = await supabase
      .from('tasks')
      .update({ metadata: { ...metadata, last_effect: before } as unknown as Json })
      .eq('id', taskId)
    if (metaError) console.error('No se pudo guardar cómo deshacer la tarea:', metaError)
  }

  revalidateTaskViews(Boolean(before.stock?.length))
  const notice = describeCompletion(task.type ?? 'otro', outcome)
  return { success: true, ...notice, canUndo: hasUndoableChanges(before) }
}


/**
 * Para la hoja de completar: las plantas que alcanza la tarea (y si ya tienen
 * ficha de cosecha) y, en una mudanza, si hace falta elegir un ciclo del
 * destino. `rawSpaceId` sirve para preguntar por otro destino antes de
 * completarla (cuando la tarea no tiene uno).
 */
export async function getCompletionContext(rawTaskId: string | number, rawSpaceId?: number | null): Promise<
  | { error: string }
  | {
      plants: { id: number; name: string; hasHarvest: boolean }[]
      ambiente: null | {
        spaceId: number | null
        spaceName: string | null
        spaces: { id: number; name: string }[]
        needsCycle: boolean
        cycles: { id: number; name: string }[]
        suggestedCycleName: string
      }
    }
> {
  const taskId = parseId(rawTaskId)
  if (!taskId) return { error: 'Esa tarea no es válida.' }

  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase } = session

  const { data: task } = await supabase.from('tasks').select(TASK_WITH_TARGETS).eq('id', taskId).maybeSingle()
  if (!task) return { error: 'No se encontró la tarea.' }

  const plants = await loadTaskPlants(supabase, task)
  let withHarvest = new Set<number>()
  if (task.type === 'cosechar' && plants.length > 0) {
    const { data } = await supabase.from('harvests').select('plant_id').in('plant_id', plants.map((plant) => plant.id))
    withHarvest = new Set((data ?? []).map((row) => Number(row.plant_id)))
  }
  const plantList = plants
    .map((plant) => ({ id: plant.id, name: plant.name ?? 'Planta', hasHarvest: withHarvest.has(plant.id) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }))

  if (task.type !== 'ambiente') return { plants: plantList, ambiente: null }

  const spaces = await getSpaceOptions()
  const spaceId = (task.target_space_id ? Number(task.target_space_id) : null) ?? parseId(rawSpaceId)
  if (!spaceId) {
    return { plants: plantList, ambiente: { spaceId: null, spaceName: null, spaces, needsCycle: false, cycles: [], suggestedCycleName: '' } }
  }

  const preview = await previewMove(supabase, task, spaceId, null)
  return {
    plants: plantList,
    ambiente: {
      spaceId: task.target_space_id ? spaceId : null,
      spaceName: preview?.spaceName ?? null,
      spaces,
      needsCycle: Boolean(preview && preview.plan.unplacedPlantIds.length > 0),
      cycles: preview?.activeInTarget ?? [],
      suggestedCycleName: preview ? `Ciclo en ${preview.spaceName}` : '',
    },
  }
}

/** Los espacios del usuario, para elegir el destino de una mudanza. */
export async function getSpaceOptions(): Promise<{ id: number; name: string }[]> {
  const session = await requireUser()
  if ('error' in session) return []
  const { data } = await session.supabase.from('spaces').select('id, name').order('name')
  return ((data ?? []) as { id: number; name: string }[]).map((space) => ({ id: Number(space.id), name: space.name }))
}

/**
 * Para editar un fertilizante: cuántos días en su etapa llevan hoy las plantas
 * de la tarea (el que menos, como al agendar) y en qué etapas están, para la
 * semana de la dosis y los avisos de etapa.
 */
export async function getTaskFeedContext(rawTaskId: string | number): Promise<{ stageDaysToday: number | null; stages: string[] }> {
  const empty = { stageDaysToday: null, stages: [] as string[] }
  const taskId = parseId(rawTaskId)
  if (!taskId) return empty

  const session = await requireUser()
  if ('error' in session) return empty

  const { data: task } = await session.supabase.from('tasks').select(TASK_WITH_TARGETS).eq('id', taskId).maybeSingle()
  if (!task) return empty

  const plants = await loadTaskPlants(session.supabase, task)
  if (plants.length === 0) return empty
  const metrics = plants.map((plant) => getPlantMetrics(plant as unknown as PlantDates))
  return {
    stageDaysToday: Math.min(...metrics.map((metric) => metric.daysInCurrentStage)),
    stages: Array.from(new Set(metrics.map((metric) => metric.currentStage).filter(Boolean))),
  }
}

/** Lo que dejó en la bitácora (y en el stock) un fertilizante al completarse. */
interface FeedResult {
  /** Plantas a las que se les anotó la mezcla. */
  plants: number
  lowStock: { name: string; stock_ml: number | null }[]
}

/**
 * Anota la mezcla de la tarea en la bitácora de cada planta (con la parte de
 * cada producto que le tocó) y, si se pidió, descuenta del stock lo que se
 * usó. Todo queda en `before` para poder deshacerlo.
 */
async function applyFeed(
  supabase: ServerSupabase,
  userId: string,
  task: { id: number; metadata: unknown },
  plants: EffectPlant[],
  details: { liters?: unknown; deductStock?: unknown },
  effectDate: string,
  before: LastEffect
): Promise<FeedResult | null> {
  const sources = await loadMixSources(supabase, userId)
  if ('error' in sources) return null
  const stored = readStoredMix(task.metadata, sources.combos, sources.fertilizers)
  if (!stored) return null

  const week = weekInStage(stored.stage_days)
  // Lo que se agendó, tal cual; en las tareas viejas, con las dosis de hoy.
  const resolved = stored.resolved ?? resolveMix(stored.items, sources.fertilizers, week)
  const label = stored.label || mixLabel(stored.items, sources.combos)

  const rawLiters = parseDecimal(details.liters)
  const liters = rawLiters !== undefined && Number.isFinite(rawLiters) && rawLiters > 0 && rawLiters <= 10000 ? rawLiters : null
  const { feed, totals } = buildFeedLog({ label, week, resolved }, liters, plants.length)

  const logs = await writePlantLogs(
    supabase,
    userId,
    plants,
    { type: 'fertilizante', title: 'Fertilizante', notes: describeFeed(feed), data: { feed } },
    effectDate,
    task.id
  )
  if (logs.length === 0) return null
  before.logs = [...(before.logs ?? []), ...logs]

  let lowStock: FeedResult['lowStock'] = []
  const changes = totals
    .filter((line) => line.total !== null && line.total > 0)
    .map((line) => ({ fertilizer_id: line.fertilizer_id, delta_ml: -(line.total as number) }))
  if (details.deductStock === true && changes.length > 0) {
    const { data: moved, error: stockError } = await supabase.rpc('move_fertilizer_stock', {
      p_changes: changes,
      p_reason: 'uso',
      p_note: 'Tarea de fertilizante',
    })
    if (stockError) {
      console.error('No se pudo descontar el stock de la tarea:', stockError)
    } else {
      // Sólo los que llevan la cuenta se movieron: esos se devuelven al deshacer.
      const tracked = new Set((moved ?? []).filter((row) => row.stock_ml !== null).map((row) => Number(row.fertilizer_id)))
      before.stock = changes.filter((change) => tracked.has(change.fertilizer_id)).map((change) => ({ fertilizer_id: change.fertilizer_id, delta: change.delta_ml }))
      lowStock = (moved ?? []).filter((row) => row.low).map((row) => ({ name: row.name, stock_ml: row.stock_ml }))
    }
  }

  return { plants: logs.length, lowStock }
}

/* --------------------------------------------------------------------------
 * Desmarcar (deshacer)
 * ----------------------------------------------------------------------- */

/**
 * Vuelve una tarea a pendiente y deshace lo que hizo al completarse: borra
 * sus registros, devuelve el stock y revierte cada cambio **sólo si sigue
 * como lo dejó la tarea** (lo que se cambió a mano después no se pisa). Sin
 * límite de tiempo. El esquejado no se deshace: los esquejes son plantas con
 * su propia historia. El "Deshacer" del aviso usa esta misma acción.
 */
export async function reopenTask(rawTaskId: string | number): Promise<{ error: string } | { success: true; message: string; tone: 'success' | 'error' }> {
  const taskId = parseId(rawTaskId)
  if (!taskId) return { error: 'Esa tarea no es válida.' }

  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase } = session

  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('id, type, status, metadata')
    .eq('id', taskId)
    .maybeSingle()
  if (fetchError || !task) return { error: friendlyDbError(fetchError, 'No se encontró la tarea.', {}, 'Error leyendo la tarea:') }

  const pending = { success: true as const, message: 'Tarea marcada como pendiente.', tone: 'success' as const }
  if (task.status !== 'completed') return pending

  const { data: changed, error } = await supabase
    .from('tasks')
    .update({ status: 'pending', completed_at: null, metadata: withoutLastEffect(task.metadata) as Json })
    .eq('id', taskId)
    .eq('status', 'completed')
    .select('id')

  if (error) return { error: friendlyDbError(error, 'No se pudo deshacer.', {}, 'Error deshaciendo la tarea:') }
  if (!changed || changed.length === 0) return pending

  const before = readLastEffect(task.metadata)
  const undone = hasUndoableChanges(before)
  const { failures, kept } = before && undone ? await revertEffect(supabase, before, taskId) : { failures: 0, kept: 0 }
  const esquejes = task.type === 'esquejado' ? Number((task.metadata as TaskMetadata | null)?.esquejado?.total ?? 0) : 0

  revalidateTaskViews(Boolean(before?.stock?.length))
  return { success: true, ...describeReopen({ undone, kept, failures, esquejes }) }
}

/**
 * Revierte lo que guardó `last_effect`. Cada paso filtra por lo que escribió
 * la tarea (`waterSet`, `stage.set`, `to`): las filas que ya no coinciden
 * cambiaron después y se cuentan en `kept`. Los `last_effect` de antes, sin
 * esos datos, se revierten sin filtro, como antes.
 */
async function revertEffect(supabase: ServerSupabase, before: LastEffect, taskId: number): Promise<{ failures: number; kept: number }> {
  let failures = 0
  let kept = 0
  const fail = (what: string, error: unknown) => {
    failures++
    console.error(`No se pudo deshacer ${what}:`, error)
  }
  const count = (rows: unknown[] | null) => rows?.length ?? 0

  // Los registros de la tarea, y el stock que sacó.
  if (before.logs?.length) {
    const { error } = await supabase.rpc('delete_task_logs', { p_task_id: taskId, p_log_ids: before.logs })
    if (error) fail('la bitácora', error)
  }
  if (before.stock?.length) {
    const { error } = await supabase.rpc('move_fertilizer_stock', {
      p_changes: before.stock.map((row) => ({ fertilizer_id: row.fertilizer_id, delta_ml: -row.delta })),
      p_reason: 'ajuste',
      p_note: 'Se deshizo una tarea de fertilizante',
    })
    if (error) fail('el stock', error)
  }

  for (const group of groupByValue((before.water ?? []).map((row) => ({ id: row.id, value: row.last_water })))) {
    let query = supabase.from('plants').update({ last_water: group.value }).in('id', group.ids)
    if (before.waterSet) query = query.eq('last_water', before.waterSet)
    const { data, error } = await query.select('id')
    if (error) fail('el riego', error)
    else if (before.waterSet) kept += group.ids.length - count(data)
  }

  if (before.archived?.length) {
    const { error } = await supabase.from('plants').update({ is_archived: false }).in('id', before.archived).eq('is_archived', true)
    if (error) fail('el archivado', error)
  }

  // La columna viene de la metadata: sólo se escribe si es una de las siete.
  const stageColumn = before.stage?.column
  if (stageColumn && STAGE_DATE_COLUMN_SET.has(stageColumn)) {
    const set = before.stage!.set
    const rows = before.stage!.plants.map((row) => ({
      id: row.id,
      value: { stage: row.stage, stage_updated_at: row.stage_updated_at, date: row.date },
    }))
    for (const group of groupByValue(rows)) {
      let query = supabase
        .from('plants')
        .update({ stage: group.value.stage, stage_updated_at: group.value.stage_updated_at, [stageColumn]: group.value.date })
        .in('id', group.ids)
      if (set) query = query.eq('stage', set.stage).eq('stage_updated_at', set.at)
      const { data, error } = await query.select('id')
      if (error) fail('la etapa', error)
      else if (set) kept += group.ids.length - count(data)
    }
  }

  // Las fichas de cosecha que creó, si no se les cargó el peso seco después.
  if (before.harvests?.length) {
    const { data, error } = await supabase.from('harvests').delete().in('plant_id', before.harvests).is('dry_g', null).select('plant_id')
    if (error) fail('la ficha de cosecha', error)
    else kept += before.harvests.length - count(data)
  }

  // Las mudanzas, directo: sus registros ya se borraron con los de la tarea.
  for (const group of groupByValue((before.plants ?? []).map((row) => ({ id: row.id, value: { back: row.cycle_id, to: row.to } })))) {
    let query = supabase.from('plants').update({ cycle_id: group.value.back }).in('id', group.ids)
    if (group.value.to !== undefined) query = group.value.to === null ? query.is('cycle_id', null) : query.eq('cycle_id', group.value.to)
    const { data, error } = await query.select('id')
    if (error) fail('el cambio de ciclo', error)
    else if (group.value.to !== undefined) kept += group.ids.length - count(data)
  }

  for (const cycle of before.cycles ?? []) {
    let query = supabase.from('cycles').update({ space_id: cycle.space_id }).eq('id', cycle.id)
    if (cycle.to !== undefined) query = query.eq('space_id', cycle.to)
    const { data, error } = await query.select('id')
    if (error) fail(`la mudanza del ciclo ${cycle.id}`, error)
    else if (cycle.to !== undefined) kept += 1 - count(data)
  }

  // El ciclo que creó la mudanza, si quedó vacío.
  if (before.createdCycle) {
    const id = before.createdCycle
    const [plantsLeft, images, measurements] = await Promise.all([
      supabase.from('plants').select('id', { count: 'exact', head: true }).eq('cycle_id', id),
      supabase.from('cycle_images').select('id', { count: 'exact', head: true }).eq('cycle_id', id),
      supabase.from('measurements').select('id', { count: 'exact', head: true }).eq('cycle_id', id),
    ])
    if ((plantsLeft.count ?? 0) + (images.count ?? 0) + (measurements.count ?? 0) === 0) {
      const { error } = await supabase.from('cycles').delete().eq('id', id)
      if (error) fail('el ciclo nuevo', error)
    } else {
      kept++
    }
  }

  return { failures, kept }
}

export async function deleteTask(taskId: string | number) {
  return deleteTasks([taskId])
}

export async function deleteTaskSeries(recurrenceId: string, currentTaskId: string | number, scope: 'this' | 'series') {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase } = session

  if (scope === 'this') {
    return deleteTask(currentTaskId)
  }

  if (scope === 'series') {
    // Fetch all IDs in series
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id')
      .eq('recurrence_id', recurrenceId)

    if (error) return { error: friendlyDbError(error, 'No se pudo leer la serie.', {}, 'Error leyendo la serie:') }
    if (!tasks || tasks.length === 0) return { success: true }

    const ids = tasks.map((t) => t.id)
    return deleteTasks(ids)
  }

  return { error: 'Opción inválida.' }
}

export async function getAllPendingTasks() {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase, user } = session

  const [tasksResult, cyclesResult] = await Promise.all([
     supabase
      .from('tasks')
      .select('*, task_cycles(cycles(id, name)), task_plants(plants(id, name, cycle_id, cycles(id, name)))')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('due_date', { ascending: true }),
     supabase
      .from('cycles')
      .select('id, name')
      .eq('is_active', true)
  ])

  if (tasksResult.error) return { error: friendlyDbError(tasksResult.error, 'No se pudieron cargar las tareas.', {}, 'Error leyendo tareas pendientes:') }
  if (cyclesResult.error) return { error: friendlyDbError(cyclesResult.error, 'No se pudieron cargar los ciclos.', {}, 'Error leyendo ciclos:') }

  // Los nombres de los ciclos, aplanados para mostrar y filtrar.
  // `status` sale de la base como texto; el check de la tabla lo limita a
  // 'pending' | 'completed', que es lo que dice `Task`.
  const tasks = tasksResult.data.map((t) => ({ ...t, ...mapTaskCycles(t) })) as unknown as Task[]

  return { tasks, cycles: cyclesResult.data }
}

// --- ESQUEJADO ---

/**
 * Todo lo que el modal de esquejado necesita para preguntar: las plantas que
 * la tarea alcanza (las enlazadas y las de sus ciclos, por si el ciclo sumó
 * plantas después de agendarla), los ciclos activos a donde mandar los
 * esquejes y los espacios, por si hay que abrir un ciclo nuevo.
 */
interface CandidatePlantRow {
  id: number
  name: string
  strain?: string | null
  breeder?: string | null
  stage?: string | null
  cycle_id?: number | null
  is_archived?: boolean | null
}

interface CycleRow {
  id: number
  name: string
  space_id?: number | null
}

export async function getEsquejadoCandidates(rawTaskId: string | number) {
  const taskId = parseId(rawTaskId)
  if (!taskId) return { error: 'Esa tarea no es válida.' }

  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase, user } = session

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select(`${TASK_WITH_TARGETS}, user_id`)
    .eq('id', taskId)
    .single()

  if (taskError || !task) return { error: 'No se encontró la tarea.' }
  if (task.user_id && task.user_id !== user.id) return { error: 'No autorizado.' }

  // Las madres posibles: las plantas que la tarea alcanza hoy (las elegidas y
  // las de sus ciclos enteros). Antes se tomaba todo ciclo enlazado, y una
  // tarea de una sola planta ofrecía a todo su ciclo.
  const targets = getTaskTargets(task)
  const [taskPlants, cyclesResult, spacesResult] = await Promise.all([
    loadTaskPlants(supabase, task),
    supabase.from('cycles').select('id, name, space_id').eq('is_active', true).order('name'),
    supabase.from('spaces').select('id, name').order('name'),
  ])

  const candidates: CandidatePlantRow[] = taskPlants
    .map((plant) => ({
      id: plant.id,
      name: plant.name ?? 'Planta',
      strain: plant.strain ?? null,
      breeder: plant.breeder ?? null,
      stage: plant.stage ?? null,
      cycle_id: plant.cycle_id ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }))

  const activeCycles: CycleRow[] = cyclesResult.data ?? []
  const defaultCycleId =
    targets.cycle_ids.find((id) => activeCycles.some((c) => c.id === id)) ??
    candidates.find((p) => p.cycle_id)?.cycle_id ??
    activeCycles[0]?.id ??
    null

  return {
    candidates,
    cycles: activeCycles,
    spaces: spacesResult.data ?? [],
    defaultCycleId,
    dueDate: task.due_date ?? null,
    alreadyRegistered: (task.metadata as TaskMetadata | null)?.esquejado ?? null,
  }
}

/**
 * Completa una tarea de esquejado creando las plantas que salieron de ella.
 *
 * Cada esqueje nace el día del corte: día 0 en Enraizamiento, con la genética y
 * la madre heredadas. El reparto (qué madre, cuántos) llega del cliente, así
 * que se depura contra las plantas que la tarea realmente alcanza.
 *
 * Plantas, ciclo nuevo y cierre de la tarea se escriben juntos en
 * `complete_esquejado`, con la tarea bloqueada: un doble envío o una falla a
 * mitad de camino ya no duplican esquejes ni dejan la tarea abierta. Si la
 * tarea ya tenía esquejes registrados (se desmarcó y se vuelve a completar),
 * sólo se cierra.
 */
export async function completeEsquejado(
  rawTaskId: string | number,
  payload: {
    date: string
    entries: CloneEntry[]
    targetCycleId?: number | null
    newCycle?: { name: string; spaceId: number | null } | null
  }
) {
  const taskId = parseId(rawTaskId)
  if (!taskId) return { error: 'Esa tarea no es válida.' }

  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase, user } = session

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select(TASK_WITH_TARGETS)
    .eq('id', taskId)
    .single()

  if (taskError || !task) return { error: 'No se encontró la tarea.' }
  if (task.type !== 'esquejado') return { error: 'La tarea no es de esquejado.' }

  const date = readDay(payload?.date) ?? todayKey()
  if (date > todayKey()) return { error: 'El día no puede ser después de hoy.' }
  const previous = (task.metadata as TaskMetadata | null)?.esquejado

  // 1. Madres posibles: las plantas que la tarea alcanza hoy.
  const mothersById = new Map<number, EffectPlant>()
  if (!previous) {
    for (const plant of await loadTaskPlants(supabase, task)) mothersById.set(Number(plant.id), plant)
  }

  const entries = previous ? [] : sanitizeCloneEntries(payload?.entries, mothersById.keys())
  const invalid = validateCloneEntries(entries)
  if (invalid) return { error: invalid }
  const total = totalClones(entries)

  // 2. Ciclo destino: uno existente o uno nuevo (sólo si hay esquejes).
  const newCycleName = typeof payload?.newCycle?.name === 'string' ? payload.newCycle.name.trim().slice(0, 80) : ''
  const newCycle = total > 0 && newCycleName
    ? { name: newCycleName, space_id: parseId(payload?.newCycle?.spaceId), start_date: date }
    : null
  const targetCycleId = total > 0 && !newCycle ? parseId(payload?.targetCycleId) : null

  if (total > 0 && !newCycle && !targetCycleId) return { error: 'Elegí a qué ciclo van los esquejes.' }

  let targetCycleName: string | null = newCycle?.name ?? null
  if (targetCycleId) {
    const { data: cycle } = await supabase.from('cycles').select('id, name').eq('id', targetCycleId).maybeSingle()
    if (!cycle) return { error: 'No se encontró el ciclo de destino.' }
    targetCycleName = cycle.name
  }

  // 3. La numeración sigue a la de los esquejes que cada madre ya tenga.
  const motherIds = entries.map((entry) => entry.motherId)
  const { data: existingClones } = motherIds.length > 0
    ? await supabase.from('plants').select('mother_id').in('mother_id', motherIds)
    : { data: [] as { mother_id: number | null }[] }

  const existingByMother = new Map<number, number>()
  for (const row of existingClones ?? []) {
    const id = Number(row.mother_id)
    existingByMother.set(id, (existingByMother.get(id) ?? 0) + 1)
  }

  const mothers: CloneMother[] = motherIds.map((id) => {
    const plant = mothersById.get(id)
    return {
      id,
      name: plant?.name ?? 'Planta',
      strain: plant?.strain ?? null,
      breeder: plant?.breeder ?? null,
      existingClones: existingByMother.get(id) ?? 0,
    }
  })

  // El ciclo lo pone la base: puede ser uno que todavía no existe.
  const seeds = buildClonePlants(entries, mothers, { cycleId: targetCycleId ?? 0, date }).map((seed) => ({
    name: seed.name,
    strain: seed.strain,
    breeder: seed.breeder,
    mother_id: seed.mother_id,
    planted_at: seed.planted_at,
  }))

  const { data: result, error } = await supabase.rpc('complete_esquejado', {
    p_task_id: taskId,
    p_seeds: seeds,
    p_summary: {
      date,
      target_cycle_id: targetCycleId,
      entries: entries.map((entry) => ({
        mother_id: entry.motherId,
        mother_name: mothersById.get(entry.motherId)?.name ?? null,
      })),
    },
    p_new_cycle: newCycle,
  })

  if (error) {
    return {
      error: friendlyDbError(error, 'No se pudo completar el esquejado.', {
        P0002: 'No se encontró la tarea, el ciclo o el espacio elegido.',
        '23503': 'Alguna planta madre ya no existe.',
        '23514': 'Elegí a qué ciclo van los esquejes.',
      }, 'Error completando el esquejado:'),
    }
  }

  const outcome = (result ?? {}) as { created?: number; already?: unknown; entries?: { mother_id: number; count: number; plant_ids: number[] }[] }

  if (outcome.already) {
    revalidateEsquejado()
    return { success: true, created: 0, alreadyRegistered: outcome.already as EsquejadoMetadata }
  }

  // Cada madre deja su registro: de ella salieron los esquejes.
  const effectDate = getTaskEffectDate(date)
  for (const entry of outcome.entries ?? []) {
    const mother = mothersById.get(Number(entry.mother_id))
    if (!mother || !entry.count) continue
    await writePlantLogs(
      supabase,
      user.id,
      [{ id: mother.id, cycle_id: mother.cycle_id ?? null }],
      {
        type: 'esquejado',
        title: entry.count === 1 ? 'Esquejado: 1 esqueje' : `Esquejado: ${entry.count} esquejes`,
        notes: targetCycleName ? `Van a ${targetCycleName}.` : null,
        data: { clone_ids: entry.plant_ids ?? [] },
      },
      effectDate,
      taskId
    )
  }

  revalidateEsquejado()
  return { success: true, created: Number(outcome.created ?? 0), cycleName: targetCycleName }
}

function revalidateEsquejado() {
  revalidatePath('/')
  revalidatePath('/calendar')
  revalidatePath('/plants')
  revalidatePath('/plants/[id]', 'page')
  revalidatePath('/cycles')
  revalidatePath('/cycles/[id]', 'page')
}
