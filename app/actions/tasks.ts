'use server'

import { requireUser } from "@/app/lib/auth"
import type { ServerSupabase } from "@/app/lib/auth"
import { TASK_TYPES, getTaskType } from "@/app/lib/constants"
import { dateKey, daysBetweenKeys, todayKey } from "@/app/lib/dates"
import { averageDays, buildRecipe, recipeItems, weekInStage, withRecipe } from "@/app/lib/nutrition"
import type { ComboInfo, FertilizerDoseInfo, NutritionSelection } from "@/app/lib/nutrition"
import { getPlantMetrics } from "@/app/lib/plant-metrics"
import type { PlantDates } from "@/app/lib/plant-metrics"
import { buildOccurrenceDates, isFrequency } from "@/app/lib/recurrence"
import { friendlyDbError } from "@/app/lib/errors"
import { parseId, parseIds } from "@/app/lib/sanitize"
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
import { moveCycleToSpace } from "../cycles/actions"
import { bulkMoveToCycle } from "./plants"
import { STAGE_DATE_COLUMNS, getStageDateColumn, isStageName } from "../lib/stage-logic"
import {
  getTaskCompletionEffect,
  getTaskEffectDate,
  inferLegacyTargets,
  planAmbienteMove,
  readTaskTargets,
  resolveTaskPlants,
  shouldApplyStage,
} from "../lib/task-effects"
import type { TargetPlant, TaskEffect, TaskTargets } from "../lib/task-effects"
import { canStillUndo, groupByValue, hasUndoableChanges, readLastEffect } from "../lib/task-undo"
import type { LastEffect } from "../lib/task-undo"

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

function readNutrition(value: unknown): NutritionSelection | null {
  const type = (value as { type?: unknown } | null)?.type
  const id = parseId((value as { id?: unknown } | null)?.id)
  return (type === 'product' || type === 'combo') && id ? { type, id } : null
}

/**
 * Prepara la receta de cada fecha de una serie de fertilizante: la semana de
 * la etapa avanza entre una repetición y otra, así que la dosis también.
 * Los días en etapa de hoy salen de las plantas del primer objetivo.
 */
async function planNutrition(
  supabase: ServerSupabase,
  userId: string,
  nutrition: NutritionSelection,
  plantIds: number[]
): Promise<((day: string) => { recipe: string; week: number }) | null> {
  const [fertilizersResult, combosResult, plantsResult] = await Promise.all([
    supabase.from('fertilizers').select('id, name, dosage_type, fixed_dosage, weekly_dosages').eq('user_id', userId),
    supabase.from('fertilizer_combos').select('id, combo_items ( fertilizer_id, fertilizers ( name ) )').eq('user_id', userId),
    plantIds.length > 0
      ? supabase.from('plants').select(`stage, planted_at, stage_updated_at, ${STAGE_DATE_SELECT}`).in('id', plantIds).eq('is_archived', false)
      : Promise.resolve({ data: [] as PlantDates[], error: null }),
  ])

  if (fertilizersResult.error || combosResult.error) {
    console.error('No se pudo leer la nutrición para la receta:', fertilizersResult.error ?? combosResult.error)
    return null
  }

  const combos: ComboInfo[] = (combosResult.data ?? []).map((combo) => ({
    id: Number(combo.id),
    products: ((combo.combo_items ?? []) as { fertilizer_id: number; fertilizers: { name: string } | { name: string }[] | null }[]).map((item) => {
      const fertilizer = Array.isArray(item.fertilizers) ? item.fertilizers[0] : item.fertilizers
      return { fertilizer_id: Number(item.fertilizer_id), name: fertilizer?.name ?? 'Producto' }
    }),
  }))

  const today = todayKey()
  const baseDays = averageDays(((plantsResult.data ?? []) as PlantDates[]).map((plant) => getPlantMetrics(plant).daysInCurrentStage)) ?? 0
  const fertilizers = (fertilizersResult.data ?? []) as FertilizerDoseInfo[]

  return (day) => {
    const week = weekInStage(baseDays + Math.max(0, daysBetweenKeys(today, day)))
    return { recipe: buildRecipe(recipeItems(nutrition, fertilizers, combos, week), week), week }
  }
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

  // 3. Receta por fecha, si es un fertilizante con producto elegido.
  const nutrition = taskType.id === 'fertilizante' ? readNutrition(form.nutrition) : null
  let recipeFor: Awaited<ReturnType<typeof planNutrition>> = null
  if (nutrition) {
    const first = targets[0]
    const weekPlantIds = first.kind === 'plant'
      ? [first.id]
      : ((cyclePlants ?? []) as { id: number; cycle_id: number | null }[])
          .filter((plant) =>
            first.kind === 'cycle'
              ? Number(plant.cycle_id) === first.id
              : (spaceCycles.data ?? []).some((cycle) => Number(cycle.id) === Number(plant.cycle_id) && Number(cycle.space_id) === first.id)
          )
          .map((plant) => Number(plant.id))
    recipeFor = await planNutrition(supabase, user.id, nutrition, weekPlantIds)
  }

  const recurrenceId = isRecurring && dates.length > 1 ? randomUUID() : null

  const rows = dates.map((day) => {
    const planned = recipeFor?.(day)
    return {
      title,
      description: planned ? withRecipe(description, planned.recipe) : description || null,
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
        ...(nutrition ? { nutrition: { ...nutrition, week: planned?.week ?? null } } : {}),
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
 * Edita una tarea, o "esta y las siguientes" de una serie. En una serie todas
 * las fechas se corren los mismos días que se movió la elegida; eso lo hace
 * `update_task_series` en una sola consulta (antes era una por tarea y los
 * errores se perdían).
 */
export async function updateTask(
  rawTaskId: string | number,
  rawUpdates: unknown,
  scope: 'single' | 'all_future' = 'single',
  recurrenceId?: string | null
) {
  const taskId = parseId(rawTaskId)
  if (!taskId) return { error: 'Esa tarea no es válida.' }

  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase } = session

  const updates = (rawUpdates ?? {}) as Record<string, unknown>
  const title = typeof updates.title === 'string' ? updates.title.trim().slice(0, 120) : ''
  if (!title) return { error: 'El título es obligatorio.' }

  const description = typeof updates.description === 'string' ? updates.description.trim().slice(0, 2000) || null : null
  const day = readDay(updates.date)
  if (!day) return { error: 'La fecha no es válida.' }

  const applicationType = updates.application_type == null
    ? null
    : APPLICATION_TYPES.find((value) => value === updates.application_type) ?? null
  if (updates.application_type != null && !applicationType) return { error: 'Elegí cómo se aplica.' }

  const targetStage = updates.target_stage == null ? null : isStageName(updates.target_stage) ? updates.target_stage : null
  if (updates.target_stage != null && !targetStage) return { error: 'Elegí la etapa de destino.' }

  if (scope === 'all_future' && recurrenceId) {
    const { error } = await supabase.rpc('update_task_series', {
      p_task_id: taskId,
      p_title: title,
      p_description: description,
      p_application_type: applicationType,
      p_target_stage: targetStage,
      p_new_day: day,
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
    const { error } = await supabase
      .from('tasks')
      .update({
        title,
        description,
        application_type: applicationType,
        target_stage: targetStage,
        // Mediodía: una fecha sin hora a las 00:00 se corre al día anterior.
        due_date: `${day}T12:00:00`,
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
  id, type, status, due_date, application_type, target_stage, target_space_id, metadata,
  task_plants ( plant_id, plants ( id, cycle_id, stage, is_archived ) ),
  task_cycles ( cycle_id )
`

/**
 * Marca una tarea como hecha o pendiente.
 *
 * El cambio de estado es condicional (sólo si el estado sigue siendo el que se
 * leyó): con un doble toque, o dos pestañas abiertas, una sola de las dos
 * llamadas aplica los efectos. Lo que cambió queda guardado en
 * `metadata.last_effect` para poder deshacerlo (`undoTaskCompletion`).
 *
 * El esquejado no pasa por acá para completarse: lo hace `completeEsquejado`,
 * que necesita saber de qué plantas salieron los esquejes y cuántos. Al
 * desmarcar una tarea los efectos se quedan: para revertirlos está "Deshacer".
 */
export async function toggleTaskStatus(rawTaskId: string | number, newStatus: 'pending' | 'completed') {
  const taskId = parseId(rawTaskId)
  if (!taskId) return { error: 'Esa tarea no es válida.' }
  if (newStatus !== 'pending' && newStatus !== 'completed') return { error: 'Estado inválido.' }

  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase } = session

  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select(TASK_WITH_TARGETS)
    .eq('id', taskId)
    .maybeSingle()

  if (fetchError || !task) return { error: friendlyDbError(fetchError, 'No se encontró la tarea.', {}, 'Error leyendo la tarea:') }

  const unchanged = { success: true as const, effects: null, ambiente: null, canUndo: false }
  if (task.status === newStatus) return unchanged

  const metadata = withoutLastEffect(task.metadata)
  const { data: changed, error } = await supabase
    .from('tasks')
    .update({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      metadata: metadata as Json,
    })
    .eq('id', taskId)
    .eq('status', task.status)
    .select('id')

  if (error) return { error: friendlyDbError(error, 'No se pudo actualizar la tarea.', {}, 'Error cambiando el estado de la tarea:') }
  // Otra llamada cambió el estado primero: los efectos ya los aplicó ella.
  if (!changed || changed.length === 0) return unchanged

  let effects: TaskCompletionEffects | null = null
  let ambiente: AmbienteMoveResult | null = null
  const before: LastEffect = { at: new Date().toISOString() }

  if (newStatus === 'completed') {
    const effect = getTaskCompletionEffect(task)
    if (effect) {
      const plants = await loadTaskPlants(supabase, task)
      if (plants.length > 0) {
        // El efecto lleva la fecha en que la tarea estaba agendada.
        const effectDate = getTaskEffectDate(task.due_date)
        effects = await applyTaskCompletionEffect(supabase, effect, plants, effectDate, before)
      }
    }

    if (task.type === 'ambiente' && task.target_space_id) {
      ambiente = await applyAmbienteMove(supabase, task, Number(task.target_space_id), before)
    }

    if (hasUndoableChanges(before)) {
      const { error: metaError } = await supabase
        .from('tasks')
        .update({ metadata: { ...metadata, last_effect: before } as unknown as Json })
        .eq('id', taskId)
      if (metaError) console.error('No se pudo guardar cómo deshacer la tarea:', metaError)
    }
  }

  revalidatePath('/')
  revalidatePath('/calendar')
  if (effects || ambiente) revalidatePlantsAndCycles()
  return { success: true as const, effects, ambiente, canUndo: hasUndoableChanges(before) }
}

/**
 * Deshace lo que hizo completar una tarea y la deja pendiente otra vez:
 * devuelve el riego, la etapa, el archivado o el espacio que tenían las
 * plantas y los ciclos. Sólo dentro de `UNDO_WINDOW_MS`: después pudieron
 * pasar otras cosas y volver atrás pisaría cambios nuevos.
 */
export async function undoTaskCompletion(rawTaskId: string | number) {
  const taskId = parseId(rawTaskId)
  if (!taskId) return { error: 'Esa tarea no es válida.' }

  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase } = session

  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('id, status, metadata')
    .eq('id', taskId)
    .maybeSingle()

  if (fetchError || !task) return { error: friendlyDbError(fetchError, 'No se encontró la tarea.', {}, 'Error leyendo la tarea:') }
  if (task.status !== 'completed') return { error: 'La tarea ya no está completada.' }

  const before = readLastEffect(task.metadata)
  if (before && !canStillUndo(before)) return { error: 'Ya pasó mucho tiempo: corregí las plantas desde su ficha.' }

  const { data: changed, error } = await supabase
    .from('tasks')
    .update({ status: 'pending', completed_at: null, metadata: withoutLastEffect(task.metadata) as Json })
    .eq('id', taskId)
    .eq('status', 'completed')
    .select('id')

  if (error) return { error: friendlyDbError(error, 'No se pudo deshacer.', {}, 'Error deshaciendo la tarea:') }
  if (!changed || changed.length === 0) return { success: true, partial: false }

  const failures = before ? await restoreBefore(supabase, before) : 0

  revalidatePath('/')
  revalidatePath('/calendar')
  revalidatePlantsAndCycles()
  return { success: true, partial: failures > 0 }
}

function withoutLastEffect(metadata: unknown): Record<string, unknown> {
  const copy = { ...((metadata as Record<string, unknown> | null) ?? {}) }
  delete copy.last_effect
  return copy
}

/** Vuelve a poner lo que guardó `last_effect`. Devuelve cuántos pasos fallaron. */
async function restoreBefore(supabase: ServerSupabase, before: LastEffect): Promise<number> {
  let failures = 0
  const fail = (what: string, error: unknown) => {
    failures++
    console.error(`No se pudo deshacer ${what}:`, error)
  }

  for (const group of groupByValue((before.water ?? []).map((row) => ({ id: row.id, value: row.last_water })))) {
    const { error } = await supabase.from('plants').update({ last_water: group.value }).in('id', group.ids)
    if (error) fail('el riego', error)
  }

  if (before.archived?.length) {
    const { error } = await supabase.from('plants').update({ is_archived: false }).in('id', before.archived)
    if (error) fail('el archivado', error)
  }

  // La columna viene de la metadata: sólo se escribe si es una de las siete.
  const stageColumn = before.stage?.column
  if (stageColumn && STAGE_DATE_COLUMN_SET.has(stageColumn)) {
    const rows = before.stage!.plants.map((row) => ({
      id: row.id,
      value: { stage: row.stage, stage_updated_at: row.stage_updated_at, date: row.date },
    }))
    for (const group of groupByValue(rows)) {
      const { error } = await supabase
        .from('plants')
        .update({
          stage: group.value.stage,
          stage_updated_at: group.value.stage_updated_at,
          [stageColumn]: group.value.date,
        })
        .in('id', group.ids)
      if (error) fail('la etapa', error)
    }
  }

  // Las mudanzas se deshacen con las mismas acciones, que dejan la bitácora.
  for (const cycle of before.cycles ?? []) {
    if (cycle.space_id != null) {
      const result = await moveCycleToSpace(cycle.id, cycle.space_id)
      if (!result.success) fail(`la mudanza del ciclo ${cycle.id}`, result.error)
    } else {
      const { error } = await supabase.from('cycles').update({ space_id: null }).eq('id', cycle.id)
      if (error) fail(`la mudanza del ciclo ${cycle.id}`, error)
    }
  }

  for (const group of groupByValue((before.plants ?? []).map((row) => ({ id: row.id, value: row.cycle_id })))) {
    const result = await bulkMoveToCycle(group.ids, group.value)
    if (!result.success) fail('el cambio de ciclo', result.error)
  }

  return failures
}

function revalidatePlantsAndCycles() {
  revalidatePath('/plants')
  revalidatePath('/plants/[id]', 'page')
  revalidatePath('/cycles')
  revalidatePath('/cycles/[id]', 'page')
  revalidatePath('/spaces')
}

/** Lo que cambió en las plantas al completar una tarea, para contárselo al usuario. */
export interface TaskCompletionEffects {
  kind: TaskEffect['kind']
  /** Plantas que efectivamente cambiaron. */
  count: number
  /** La etapa nueva, cuando el efecto es un cambio de etapa. */
  stage?: string
}

type TaskWithTargets = {
  metadata?: unknown
  task_plants?: { plant_id: number; plants?: TargetPlant | null }[] | null
  task_cycles?: { cycle_id: number }[] | null
}

/** Una planta alcanzada por la tarea, con lo necesario para deshacer el efecto. */
type EffectPlant = TargetPlant & {
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

/** Lo que mudó una tarea de "Cambiar ambiente", para contárselo al usuario. */
export interface AmbienteMoveResult {
  spaceName: string
  /** Ciclos mudados al espacio. */
  cycles: number
  /** Plantas sueltas pasadas al ciclo del espacio. */
  plants: number
  /** Plantas sueltas que no se movieron porque el espacio no tiene un único ciclo activo. */
  unplaced: number
}

/**
 * Muda al espacio destino los ciclos elegidos enteros y pasa las plantas
 * elegidas sueltas al ciclo activo de ese espacio (ver `planAmbienteMove`).
 * Un ciclo enlazado sólo porque una de sus plantas era el objetivo no se muda.
 */
async function applyAmbienteMove(
  supabase: ServerSupabase,
  task: TaskWithTargets,
  targetSpaceId: number,
  before: LastEffect
): Promise<AmbienteMoveResult | null> {
  const targets = getTaskTargets(task)

  const [spaceResult, plantsResult, activeResult] = await Promise.all([
    supabase.from('spaces').select('id, name').eq('id', targetSpaceId).single(),
    targets.plant_ids.length > 0
      ? supabase.from('plants').select('id, cycle_id, is_archived').in('id', targets.plant_ids)
      : Promise.resolve({ data: [] as TargetPlant[], error: null }),
    supabase.from('cycles').select('id').eq('space_id', targetSpaceId).eq('is_active', true),
  ])

  if (spaceResult.error || !spaceResult.data) {
    console.error('No se encontró el espacio destino de la tarea:', spaceResult.error)
    return null
  }

  const plants = (plantsResult.data ?? []) as TargetPlant[]
  const involvedCycleIds = Array.from(new Set([
    ...targets.cycle_ids,
    ...plants.map((plant) => Number(plant.cycle_id)).filter(Boolean),
  ]))

  const { data: involvedCycles } = involvedCycleIds.length > 0
    ? await supabase.from('cycles').select('id, space_id').in('id', involvedCycleIds)
    : { data: [] as { id: number; space_id: number | null }[] }

  const cycleSpaces = new Map<number, number | null>(
    (involvedCycles ?? []).map((cycle: { id: number; space_id: number | null }) => [
      Number(cycle.id),
      cycle.space_id == null ? null : Number(cycle.space_id),
    ])
  )

  const plan = planAmbienteMove(
    // Un ciclo que ya no existe no se puede mudar.
    { ...targets, cycle_ids: targets.cycle_ids.filter((id) => cycleSpaces.has(id)) },
    targetSpaceId,
    plants,
    cycleSpaces,
    (activeResult.data ?? []).map((cycle: { id: number }) => Number(cycle.id))
  )

  // Se reusan las mudanzas de siempre, que además dejan la bitácora.
  const movedCycles: { id: number; space_id: number | null }[] = []
  for (const cycleId of plan.cycleIds) {
    const result = await moveCycleToSpace(cycleId, targetSpaceId)
    if (result.success) movedCycles.push({ id: cycleId, space_id: cycleSpaces.get(cycleId) ?? null })
    else console.error(`No se pudo mudar el ciclo ${cycleId}:`, result.error)
  }

  let movedPlants = 0
  if (plan.targetCycleId != null && plan.plantIds.length > 0) {
    const result = await bulkMoveToCycle(plan.plantIds, plan.targetCycleId)
    if (result.success) {
      movedPlants = plan.plantIds.length
      const previous = new Map(plants.map((plant) => [Number(plant.id), plant.cycle_id == null ? null : Number(plant.cycle_id)]))
      before.plants = plan.plantIds.map((id) => ({ id, cycle_id: previous.get(id) ?? null }))
    } else {
      console.error('No se pudieron pasar las plantas al ciclo del espacio:', result.error)
    }
  }
  if (movedCycles.length > 0) before.cycles = movedCycles

  return {
    spaceName: spaceResult.data.name,
    cycles: movedCycles.length,
    plants: movedPlants,
    unplaced: plan.unplacedPlantIds.length,
  }
}

/**
 * Las plantas a las que alcanza la tarea hoy: las elegidas una por una y las
 * que están ahora en sus ciclos. Una planta que entró al ciclo después de
 * agendar la tarea también cuenta, y una que se fue a otro ciclo ya no.
 */
async function loadTaskPlants(supabase: ServerSupabase, task: TaskWithTargets): Promise<EffectPlant[]> {
  const targets = getTaskTargets(task)

  // Con lo que hace falta para deshacer: riego, fecha de etapa y las siete fechas.
  const columns = `id, cycle_id, stage, is_archived, last_water, stage_updated_at, ${STAGE_DATE_SELECT}`
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
    (byPlant.data ?? []) as EffectPlant[],
    (byCycle.data ?? []) as EffectPlant[]
  ) as EffectPlant[]
}

/**
 * Aplica sobre las plantas de la tarea el efecto de haberla completado, y
 * anota en `before` cómo estaban para poder deshacerlo.
 *
 * Si algo falla no se revierte el completado: la tarea sí se hizo, y queda
 * en el log del servidor.
 */
async function applyTaskCompletionEffect(
  supabase: ServerSupabase,
  effect: TaskEffect,
  plants: EffectPlant[],
  effectDate: string,
  before: LastEffect
): Promise<TaskCompletionEffects | null> {
  if (effect.kind === 'water') {
    const ids = plants.map((plant) => plant.id)
    // `last_water` guarda el día de calendario, como el riego en lote.
    const { error } = await supabase.from('plants').update({ last_water: dateKey(effectDate) }).in('id', ids)
    if (error) {
      console.error('Error updating last_water:', error)
      return null
    }
    before.water = plants.map((plant) => ({ id: plant.id, last_water: plant.last_water ?? null }))
    return { kind: 'water', count: ids.length }
  }

  if (effect.kind === 'archive') {
    // `resolveTaskPlants` ya dejó afuera las archivadas: todas estaban activas.
    const ids = plants.map((plant) => plant.id)
    const { error } = await supabase.from('plants').update({ is_archived: true }).in('id', ids)
    if (error) {
      console.error('Error archivando plantas al completar la tarea:', error)
      return null
    }
    before.archived = ids
    return { kind: 'archive', count: ids.length }
  }

  // Cambio de etapa: sólo las plantas que no están ya ahí (o más adelante,
  // si el efecto sólo avanza).
  const dateColumn = getStageDateColumn(effect.stage)
  if (!dateColumn) return null

  const changing = plants.filter((plant) => shouldApplyStage(plant.stage, effect))
  const ids = changing.map((plant) => plant.id)

  if (ids.length > 0) {
    const { error } = await supabase
      .from('plants')
      .update({
        stage: effect.stage,
        stage_updated_at: effectDate,
        // La columna sale del mapa de etapas, nunca del cliente.
        [dateColumn]: effectDate,
      })
      .in('id', ids)

    if (error) {
      console.error('Error cambiando la etapa al completar la tarea:', error)
      return null
    }

    before.stage = {
      column: dateColumn,
      plants: changing.map((plant) => ({
        id: plant.id,
        stage: plant.stage ?? null,
        stage_updated_at: plant.stage_updated_at ?? null,
        date: (plant[dateColumn] as string | null | undefined) ?? null,
      })),
    }
  }

  return { kind: 'stage', count: ids.length, stage: effect.stage }
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
    .select('id, user_id, type, status, due_date, metadata, task_plants(plant_id), task_cycles(cycle_id)')
    .eq('id', taskId)
    .single()

  if (taskError || !task) return { error: 'No se encontró la tarea.' }
  if (task.user_id && task.user_id !== user.id) return { error: 'No autorizado.' }

  const cycleIds: number[] = (task.task_cycles ?? []).map((tc: { cycle_id: number }) => tc.cycle_id).filter(Boolean)
  const plantIds: number[] = (task.task_plants ?? []).map((tp: { plant_id: number }) => tp.plant_id).filter(Boolean)

  const columns = 'id, name, strain, breeder, stage, cycle_id, is_archived'
  const [byPlant, byCycle, cyclesResult, spacesResult] = await Promise.all([
    plantIds.length > 0
      ? supabase.from('plants').select(columns).in('id', plantIds)
      : Promise.resolve({ data: [] as CandidatePlantRow[] }),
    cycleIds.length > 0
      ? supabase.from('plants').select(columns).in('cycle_id', cycleIds)
      : Promise.resolve({ data: [] as CandidatePlantRow[] }),
    supabase.from('cycles').select('id, name, space_id').eq('is_active', true).order('name'),
    supabase.from('spaces').select('id, name').order('name'),
  ])

  // Una planta puede venir por los dos lados (enlazada y por su ciclo).
  const candidatesById = new Map<number, CandidatePlantRow>()
  for (const plant of [...(byPlant.data ?? []), ...(byCycle.data ?? [])] as CandidatePlantRow[]) {
    if (plant?.is_archived) continue
    candidatesById.set(Number(plant.id), plant)
  }

  const candidates = Array.from(candidatesById.values()).sort((a, b) =>
    String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es')
  )

  const activeCycles: CycleRow[] = cyclesResult.data ?? []
  const defaultCycleId =
    cycleIds.find((id) => activeCycles.some((c) => c.id === id)) ??
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
  const { supabase } = session

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, type, metadata, task_plants(plant_id), task_cycles(cycle_id)')
    .eq('id', taskId)
    .single()

  if (taskError || !task) return { error: 'No se encontró la tarea.' }
  if (task.type !== 'esquejado') return { error: 'La tarea no es de esquejado.' }

  const date = readDay(payload?.date) ?? todayKey()
  const previous = (task.metadata as TaskMetadata | null)?.esquejado

  // 1. Candidatas reales de la tarea: las enlazadas más las de sus ciclos.
  const cycleIds = (task.task_cycles ?? []).map((tc) => Number(tc.cycle_id)).filter(Boolean)
  const linkedPlantIds = (task.task_plants ?? []).map((tp) => Number(tp.plant_id)).filter(Boolean)

  const [byPlant, byCycle] = previous
    ? [{ data: [] as CandidatePlantRow[] }, { data: [] as CandidatePlantRow[] }]
    : await Promise.all([
        linkedPlantIds.length > 0
          ? supabase.from('plants').select('id, name, strain, breeder').in('id', linkedPlantIds)
          : Promise.resolve({ data: [] as CandidatePlantRow[] }),
        cycleIds.length > 0
          ? supabase.from('plants').select('id, name, strain, breeder').in('cycle_id', cycleIds)
          : Promise.resolve({ data: [] as CandidatePlantRow[] }),
      ])

  const mothersById = new Map<number, CandidatePlantRow>()
  for (const plant of [...(byPlant.data ?? []), ...(byCycle.data ?? [])] as CandidatePlantRow[]) {
    mothersById.set(Number(plant.id), plant)
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

  const outcome = (result ?? {}) as { created?: number; already?: unknown }
  revalidateEsquejado()

  if (outcome.already) {
    return { success: true, created: 0, alreadyRegistered: outcome.already as EsquejadoMetadata }
  }
  return { success: true, created: Number(outcome.created ?? 0), cycleName: targetCycleName }
}

function revalidateEsquejado() {
  revalidatePath('/')
  revalidatePath('/calendar')
  revalidatePath('/plants')
  revalidatePath('/cycles')
  revalidatePath('/cycles/[id]', 'page')
}
