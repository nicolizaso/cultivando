'use server'

import { createClient } from "@/app/lib/supabase-server"
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
import type { TaskMetadata } from "../lib/types"
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

/** Las siete columnas de fecha de etapa, para pedirlas en un select. */
const STAGE_DATE_SELECT = Object.values(STAGE_DATE_COLUMNS).join(', ')

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
    p_tasks: rows,
    p_cycle_ids: linkedCycleIds,
    p_plant_ids: linkedPlantIds,
  })

  if (error) return { error: friendlyDbError(error, 'No se pudo agendar la tarea.', {}, 'Error creando tareas:') }

  revalidatePath('/')
  revalidatePath('/calendar')
  return { success: true, created: rows.length, truncated }
}

// --- NUEVAS FUNCIONES PARA EL POPUP ---

export async function updateTask(taskId: string | number, updates: any, scope: 'single' | 'all_future' = 'single', recurrenceId?: string) {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase } = session
  
  if (scope === 'single') {
    const { error } = await supabase
      .from('tasks')
      .update({
        title: updates.title,
        description: updates.description,
        application_type: updates.application_type !== undefined ? updates.application_type : null,
        target_stage: updates.target_stage !== undefined ? updates.target_stage : null,
        due_date: updates.date,
        date: updates.date
      })
      .eq('id', taskId)

    if (error) return { error: friendlyDbError(error, 'No se pudo actualizar la tarea.', {}, 'Error actualizando tarea:') }
  } else if (scope === 'all_future' && recurrenceId) {
    // 1. Fetch current task to get old date
    const { data: currentTask, error: fetchError } = await supabase
      .from('tasks')
      .select('due_date')
      .eq('id', taskId)
      .single()

    if (fetchError || !currentTask) return { error: 'No se encontró la tarea.' }

    // 2. Calculate delta days
    // Ensure we parse dates correctly (YYYY-MM-DD)
    const oldDateStr = currentTask.due_date.split('T')[0]
    const newDateStr = updates.date.split('T')[0]

    const oldDate = new Date(oldDateStr)
    const newDate = new Date(newDateStr)

    const diffTime = newDate.getTime() - oldDate.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

    // 3. Fetch all future tasks in series (inclusive of current task)
    const { data: futureTasks, error: listError } = await supabase
      .from('tasks')
      .select('*')
      .eq('recurrence_id', recurrenceId)
      .gte('due_date', currentTask.due_date)

    if (listError) return { error: friendlyDbError(listError, 'No se pudo leer la serie.', {}, 'Error leyendo la serie:') }
    if (!futureTasks || futureTasks.length === 0) return { success: true }

    // 4. Update each task
    const updatesPromises = futureTasks.map(task => {
      // Apply date shift
      const taskDate = new Date(task.due_date.split('T')[0]) // Parse local YYYY-MM-DD
      taskDate.setDate(taskDate.getDate() + diffDays)

      // Format back to YYYY-MM-DD
      const shiftedDateStr = taskDate.toISOString().split('T')[0]
      const shiftedDateFull = `${shiftedDateStr}T12:00:00` // Append noon

      return supabase.from('tasks').update({
        title: updates.title || task.title,
        description: updates.description !== undefined ? updates.description : task.description,
        application_type: updates.application_type !== undefined ? updates.application_type : task.application_type,
        target_stage: updates.target_stage !== undefined ? updates.target_stage : task.target_stage,
        due_date: shiftedDateFull,
        date: shiftedDateFull
      }).eq('id', task.id)
    })

    await Promise.all(updatesPromises)
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

export async function toggleTaskStatus(taskId: string | number, newStatus: 'pending' | 'completed') {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase } = session

  if (newStatus !== 'pending' && newStatus !== 'completed') return { error: 'Estado inválido.' }

  // Check current status to prevent duplicate logs/updates
  const { data: currentTask, error: fetchError } = await supabase
    .from('tasks')
    .select('status')
    .eq('id', taskId)
    .single()

  if (fetchError || !currentTask) return { error: friendlyDbError(fetchError, 'No se encontró la tarea.', {}, 'Error leyendo la tarea:') }
  if (currentTask.status === newStatus) return { success: true }

  const completedAt = new Date().toISOString()
  const updateData: any = { status: newStatus }
  if (newStatus === 'completed') {
    updateData.completed_at = completedAt
  } else {
    updateData.completed_at = null
  }

  const { error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)

  if (error) return { error: friendlyDbError(error, 'No se pudo actualizar la tarea.', {}, 'Error cambiando el estado de la tarea:') }

  let effects: TaskCompletionEffects | null = null
  let ambiente: AmbienteMoveResult | null = null

  // El esquejado no pasa por acá para completarse: lo hace `completeEsquejado`,
  // que necesita saber de qué plantas salieron los esquejes y cuántos. Al
  // desmarcarla, las plantas creadas se quedan donde están.
  if (newStatus === 'completed') {
    const { data: task } = await supabase
      .from('tasks')
      .select(`
        *,
        task_plants (
          plant_id,
          plants ( id, cycle_id, stage, is_archived )
        ),
        task_cycles (
          cycle_id
        )
      `)
      .eq('id', taskId)
      .single()

    if (task) {
      const effect = getTaskCompletionEffect(task)
      if (effect) {
        const plants = await loadTaskPlants(supabase, task)
        if (plants.length > 0) {
          // El efecto lleva la fecha en que la tarea estaba agendada.
          const effectDate = getTaskEffectDate(task.due_date)
          effects = await applyTaskCompletionEffect(supabase, effect, plants, effectDate)
        }
      }

      if (task.type === 'ambiente' && task.target_space_id) {
        ambiente = await applyAmbienteMove(supabase, task, Number(task.target_space_id))
      }
    }
  }

  revalidatePath('/')
  revalidatePath('/calendar')
  if (effects || ambiente) {
    revalidatePath('/plants')
    revalidatePath('/plants/[id]', 'page')
    revalidatePath('/cycles')
    revalidatePath('/cycles/[id]', 'page')
  }
  return { success: true, effects, ambiente }
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
  supabase: Awaited<ReturnType<typeof createClient>>,
  task: TaskWithTargets,
  targetSpaceId: number
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
  let movedCycles = 0
  for (const cycleId of plan.cycleIds) {
    const result = await moveCycleToSpace(cycleId, targetSpaceId)
    if (result.success) movedCycles++
    else console.error(`No se pudo mudar el ciclo ${cycleId}:`, result.error)
  }

  let movedPlants = 0
  if (plan.targetCycleId != null && plan.plantIds.length > 0) {
    const result = await bulkMoveToCycle(plan.plantIds, plan.targetCycleId)
    if (result.success) movedPlants = plan.plantIds.length
    else console.error('No se pudieron pasar las plantas al ciclo del espacio:', result.error)
  }

  return {
    spaceName: spaceResult.data.name,
    cycles: movedCycles,
    plants: movedPlants,
    unplaced: plan.unplacedPlantIds.length,
  }
}

/**
 * Las plantas a las que alcanza la tarea hoy: las elegidas una por una y las
 * que están ahora en sus ciclos. Una planta que entró al ciclo después de
 * agendar la tarea también cuenta, y una que se fue a otro ciclo ya no.
 */
async function loadTaskPlants(
  supabase: Awaited<ReturnType<typeof createClient>>,
  task: TaskWithTargets
): Promise<TargetPlant[]> {
  const targets = getTaskTargets(task)

  const columns = 'id, cycle_id, stage, is_archived'
  const [byPlant, byCycle] = await Promise.all([
    targets.plant_ids.length > 0
      ? supabase.from('plants').select(columns).in('id', targets.plant_ids)
      : Promise.resolve({ data: [] as TargetPlant[], error: null }),
    targets.cycle_ids.length > 0
      ? supabase.from('plants').select(columns).in('cycle_id', targets.cycle_ids)
      : Promise.resolve({ data: [] as TargetPlant[], error: null }),
  ])

  if (byPlant.error) console.error('Error leyendo las plantas de la tarea:', byPlant.error)
  if (byCycle.error) console.error('Error leyendo las plantas de los ciclos de la tarea:', byCycle.error)

  return resolveTaskPlants(
    targets,
    (byPlant.data ?? []) as TargetPlant[],
    (byCycle.data ?? []) as TargetPlant[]
  )
}

/**
 * Aplica sobre las plantas de la tarea el efecto de haberla completado.
 *
 * Si algo falla no se revierte el completado: la tarea sí se hizo, y queda
 * en el log del servidor. Desmarcar la tarea tampoco deshace el efecto, igual
 * que con los esquejes: la etapa o el archivado se corrigen desde la planta.
 */
async function applyTaskCompletionEffect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  effect: TaskEffect,
  plants: TargetPlant[],
  effectDate: string
): Promise<TaskCompletionEffects | null> {
  if (effect.kind === 'water') {
    const ids = plants.map((plant) => plant.id)
    // `last_water` guarda el día de calendario, como el riego en lote.
    const { error } = await supabase.from('plants').update({ last_water: dateKey(effectDate) }).in('id', ids)
    if (error) {
      console.error('Error updating last_water:', error)
      return null
    }
    return { kind: 'water', count: ids.length }
  }

  if (effect.kind === 'archive') {
    const ids = plants.map((plant) => plant.id)
    const { error } = await supabase.from('plants').update({ is_archived: true }).in('id', ids)
    if (error) {
      console.error('Error archivando plantas al completar la tarea:', error)
      return null
    }
    return { kind: 'archive', count: ids.length }
  }

  // Cambio de etapa: sólo las plantas que no están ya ahí (o más adelante,
  // si el efecto sólo avanza).
  const dateColumn = getStageDateColumn(effect.stage)
  if (!dateColumn) return null

  const ids = plants
    .filter((plant) => shouldApplyStage(plant.stage, effect))
    .map((plant) => plant.id)

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

    const ids = tasks.map((t: any) => t.id)
    return deleteTasks(ids)
  }

  return { error: 'Opción inválida.' }
}

export async function getAllPendingTasks() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Debes iniciar sesión.' }

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

  // Map tasks to flatten cycleName
  const tasks = tasksResult.data.map((t: any) => {
    const { cycleIds, cycleNames } = mapTaskCycles(t, cyclesResult.data);

    return {
      ...t,
      cycleIds,
      cycleNames
    }
  })

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
  space_id?: number
}

export async function getEsquejadoCandidates(taskId: string | number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Debes iniciar sesión.' }

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
 * Es idempotente: si la tarea ya tiene esquejes registrados (porque se desmarcó
 * y se volvió a completar), vuelve a marcarla completada sin duplicar plantas.
 */
export async function completeEsquejado(
  taskId: string | number,
  payload: {
    date: string
    entries: CloneEntry[]
    targetCycleId?: number | null
    newCycle?: { name: string; spaceId: number } | null
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Debes iniciar sesión.' }

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, user_id, type, metadata, task_plants(plant_id), task_cycles(cycle_id)')
    .eq('id', taskId)
    .single()

  if (taskError || !task) return { error: 'No se encontró la tarea.' }
  if (task.user_id && task.user_id !== user.id) return { error: 'No autorizado.' }
  if (task.type !== 'esquejado') return { error: 'La tarea no es de esquejado.' }

  const previous = (task.metadata as TaskMetadata | null)?.esquejado
  if (previous) {
    // Ya se registró antes: sólo hay que volver a cerrarla.
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', taskId)

    if (error) return { error: friendlyDbError(error, 'No se pudo completar la tarea.', {}, 'Error completando el esquejado:') }

    revalidateEsquejado()
    return { success: true, created: 0, alreadyRegistered: previous }
  }

  // 1. Candidatas reales de la tarea: las enlazadas más las de sus ciclos.
  const cycleIds: number[] = (task.task_cycles ?? []).map((tc: { cycle_id: number }) => tc.cycle_id).filter(Boolean)
  const linkedPlantIds: number[] = (task.task_plants ?? []).map((tp: { plant_id: number }) => tp.plant_id).filter(Boolean)

  const [byPlant, byCycle] = await Promise.all([
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

  const entries = sanitizeCloneEntries(payload.entries, mothersById.keys())
  const invalid = validateCloneEntries(entries)
  if (invalid) return { error: invalid }

  const total = totalClones(entries)
  const date = payload.date || new Date().toLocaleDateString('en-CA')

  // 2. Sin esquejes no hay plantas que crear, pero la tarea igual se hizo.
  if (total === 0) {
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        metadata: {
          ...((task.metadata as object) ?? {}),
          esquejado: {
            date,
            target_cycle_id: null,
            total: 0,
            entries: [],
            registered_at: new Date().toISOString(),
          },
        },
      })
      .eq('id', taskId)

    if (error) return { error: friendlyDbError(error, 'No se pudo completar la tarea.', {}, 'Error completando el esquejado:') }

    revalidateEsquejado()
    return { success: true, created: 0 }
  }

  // 3. Ciclo destino: uno existente o uno nuevo creado en el momento.
  let targetCycleId = payload.targetCycleId ? Number(payload.targetCycleId) : null
  let targetCycleName: string | null = null

  if (payload.newCycle?.name?.trim()) {
    const { data: created, error: cycleError } = await supabase
      .from('cycles')
      .insert({
        name: payload.newCycle.name.trim(),
        start_date: date,
        space_id: payload.newCycle.spaceId,
        is_active: true,
        user_id: user.id,
      })
      .select('id, name')
      .single()

    if (cycleError || !created) return { error: 'No se pudo crear el ciclo de destino.' }

    targetCycleId = created.id
    targetCycleName = created.name
  } else if (targetCycleId) {
    const { data: cycle } = await supabase
      .from('cycles')
      .select('id, name')
      .eq('id', targetCycleId)
      .single()

    if (!cycle) return { error: 'No se encontró el ciclo de destino.' }
    targetCycleName = cycle.name
  }

  if (!targetCycleId) return { error: 'Elegí a qué ciclo van los esquejes.' }

  // 4. La numeración sigue a la de los esquejes que cada madre ya tenga.
  const motherIds = entries.map((entry) => entry.motherId)
  const { data: existingClones } = await supabase
    .from('plants')
    .select('mother_id')
    .in('mother_id', motherIds)

  const existingByMother = new Map<number, number>()
  for (const row of (existingClones ?? []) as { mother_id: number }[]) {
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

  const seeds = buildClonePlants(entries, mothers, { cycleId: targetCycleId, date })

  const { data: insertedPlants, error: insertError } = await supabase
    .from('plants')
    .insert(seeds.map((seed) => ({ ...seed, user_id: user.id })))
    .select('id, mother_id')

  if (insertError) {
    console.error('Error creando esquejes:', insertError)
    return { error: 'No se pudieron crear los esquejes.' }
  }

  // 5. El resultado queda en la tarea: es lo que la vuelve idempotente.
  const plantIdsByMother = new Map<number, number[]>()
  for (const plant of (insertedPlants ?? []) as { id: number; mother_id: number }[]) {
    const id = Number(plant.mother_id)
    plantIdsByMother.set(id, [...(plantIdsByMother.get(id) ?? []), Number(plant.id)])
  }

  const { error: updateError } = await supabase
    .from('tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      metadata: {
        ...((task.metadata as object) ?? {}),
        esquejado: {
          date,
          target_cycle_id: targetCycleId,
          total,
          registered_at: new Date().toISOString(),
          entries: entries.map((entry) => ({
            mother_id: entry.motherId,
            mother_name: mothersById.get(entry.motherId)?.name ?? null,
            count: entry.count,
            plant_ids: plantIdsByMother.get(entry.motherId) ?? [],
          })),
        },
      },
    })
    .eq('id', taskId)

  if (updateError) return { error: friendlyDbError(updateError, 'Los esquejes se crearon pero la tarea no se pudo cerrar.', {}, 'Error cerrando el esquejado:') }

  revalidateEsquejado()
  return { success: true, created: total, cycleId: targetCycleId, cycleName: targetCycleName }
}

function revalidateEsquejado() {
  revalidatePath('/')
  revalidatePath('/calendar')
  revalidatePath('/plants')
  revalidatePath('/cycles')
  revalidatePath('/cycles/[id]', 'page')
}
