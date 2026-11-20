'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/app/lib/auth'
import { friendlyDbError } from '@/app/lib/errors'
import { getTaskType } from '@/app/lib/constants'
import { dominantStage, stagePeriods } from '@/app/lib/climate'
import { dateKey, todayKey } from '@/app/lib/dates'
import { MAX_CUSTOM_NOTE, MAX_CUSTOM_TASKS, buildGrowPlan, isCustomPlanType } from '@/app/lib/grow-plan'
import type { CustomPlanTask, GrowPlanOptions } from '@/app/lib/grow-plan'
import { DEFAULT_FLOWER_WEEKS, MAX_FLOWER_WEEKS, MIN_FLOWER_WEEKS } from '@/app/lib/cycle-week'
import { buildStoredMix, mixRecipe, parseMixInput } from '@/app/lib/nutrition'
import type { MixItem } from '@/app/lib/nutrition'
import { loadMixSources, ownsAll } from '@/app/lib/nutrition-data'
import { parseId } from '@/app/lib/sanitize'
import type { Json } from '@/app/lib/database.types'

const PLANT_COLUMNS =
  'id, stage, is_archived, stage_updated_at, date_germinacion, date_plantula, date_enraizamiento, date_vegetativo, date_floracion, date_secado, date_curado' as const

/** La mezcla de una etapa: [{ fertilizer_id, custom_dose }], o null si no lleva. */
function readMixItems(value: unknown): MixItem[] | null | 'invalid' {
  const parsed = parseMixInput({ items: value ?? null })
  return parsed === 'invalid' ? 'invalid' : parsed?.items ?? null
}

const num = (value: unknown, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Las tareas propias del plan, validadas una por una: tipo de la lista
 * permitida, etapa vege o flora, semana 1–30, día 1–7 y nota corta. "Otro"
 * necesita nota, porque es su nombre.
 */
function readCustomTasks(value: unknown): CustomPlanTask[] | string {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) return 'Revisá tus tareas del plan.'
  if (value.length > MAX_CUSTOM_TASKS) return `Se pueden sumar hasta ${MAX_CUSTOM_TASKS} tareas propias.`
  const tasks: CustomPlanTask[] = []
  for (const [index, raw] of value.entries()) {
    const item = (raw ?? {}) as Record<string, unknown>
    const week = Number(item.week)
    const day = Number(item.day)
    const note = typeof item.note === 'string' ? item.note.trim() : ''
    if (!isCustomPlanType(item.type)) return 'Alguna de tus tareas tiene un tipo que no va en el plan.'
    if (item.stage !== 'Vegetativo' && item.stage !== 'Floración') return 'Revisá la etapa de tus tareas.'
    if (!Number.isInteger(week) || week < 1 || week > 30) return 'La semana de cada tarea va de 1 a 30.'
    if (!Number.isInteger(day) || day < 1 || day > 7) return 'El día de cada tarea va de 1 a 7.'
    if (note.length > MAX_CUSTOM_NOTE) return `La nota de cada tarea puede tener hasta ${MAX_CUSTOM_NOTE} letras.`
    if (item.type === 'otro' && !note) return 'Escribí qué es cada tarea "Otro".'
    tasks.push({ id: String(index), type: item.type, stage: item.stage, week, day, ...(note ? { note } : {}) })
  }
  return tasks
}

const FLUSH_NOTE = 'Riego abundante con agua sola, para lavar las sales antes de cosechar.'

/**
 * Crea las tareas del plan de cultivo de un ciclo. La etapa y su fecha de
 * inicio se leen de la base (no del cliente); del cliente vienen sólo las
 * opciones y qué tareas de la vista previa se destildaron.
 */
export async function createGrowPlan(rawCycleId: number, rawOptions: unknown, excludedKeys: unknown = []) {
  const cycleId = parseId(rawCycleId)
  if (!cycleId) return { error: 'Ese ciclo no es válido.' }

  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase, user } = session

  const [{ data: cycle }, { data: plants }, sources] = await Promise.all([
    supabase.from('cycles').select('id, is_active').eq('id', cycleId).maybeSingle(),
    supabase.from('plants').select(PLANT_COLUMNS).eq('cycle_id', cycleId).eq('is_archived', false),
    loadMixSources(supabase, user.id),
  ])
  if ('error' in sources) return { error: sources.error }

  if (!cycle) return { error: 'No se encontró el ciclo.' }
  if (!cycle.is_active) return { error: 'El ciclo está finalizado.' }
  if (!plants || plants.length === 0) return { error: 'El ciclo no tiene plantas activas.' }

  const stage = dominantStage(plants)
  // El inicio de la etapa: por las fechas de etapa o, si no están cargadas,
  // por el último cambio de etapa de las plantas que están en ella.
  const stageStart = stagePeriods(plants).find((period) => period.stage === stage)?.from
    ?? plants
      .filter((plant) => plant.stage === stage)
      .map((plant) => dateKey(plant.stage_updated_at))
      .filter((day): day is string => Boolean(day))
      .sort()[0]
  if (!stage || !stageStart) return { error: 'Cargá en qué etapa están las plantas (con su fecha) para armar el plan.' }

  const raw = (rawOptions ?? {}) as Record<string, unknown>
  const vegMix = readMixItems(raw.vegNutrition)
  const flowerMix = readMixItems(raw.flowerNutrition)
  if (vegMix === 'invalid' || flowerMix === 'invalid') return { error: 'Revisá los fertilizantes del plan.' }
  if ((vegMix && !ownsAll(vegMix, sources.fertilizers)) || (flowerMix && !ownsAll(flowerMix, sources.fertilizers))) {
    return { error: 'Alguno de los productos ya no existe.' }
  }

  const custom = readCustomTasks(raw.custom)
  if (typeof custom === 'string') return { error: custom }

  // La flora va en semanas enteras: así la meta del ciclo y la tarea de
  // cosecha caen el mismo día.
  const flowerWeeks = Math.round(num(raw.flowerWeeks, DEFAULT_FLOWER_WEEKS))
  if (flowerWeeks < MIN_FLOWER_WEEKS || flowerWeeks > MAX_FLOWER_WEEKS) {
    return { error: `La flora tiene que durar entre ${MIN_FLOWER_WEEKS} y ${MAX_FLOWER_WEEKS} semanas.` }
  }

  const include = (raw.include ?? {}) as Record<string, unknown>
  const options: GrowPlanOptions = {
    today: todayKey(),
    currentStage: stage,
    stageStart,
    vegDays: num(raw.vegDays, 35),
    flowerDays: flowerWeeks * 7,
    waterEvery: num(raw.waterEvery, 3),
    feedEvery: num(raw.feedEvery, 2),
    flushDays: num(raw.flushDays, 10),
    vegNutrition: vegMix,
    flowerNutrition: flowerMix,
    include: { stageChange: include.stageChange !== false, harvest: include.harvest !== false, flush: include.flush !== false },
    custom,
  }

  const plan = buildGrowPlan(options)
  if (!plan) return { error: 'El ciclo ya está cosechado: no hay plan que armar.' }

  const excluded = new Set(Array.isArray(excludedKeys) ? excludedKeys.filter((key): key is string => typeof key === 'string') : [])
  const items = plan.items.filter((item) => !excluded.has(item.key))
  if (items.length === 0) return { error: 'No quedó ninguna tarea para crear.' }

  const planId = randomUUID()
  const targets = { cycle_ids: [cycleId], plant_ids: [] as number[] }
  const rows = items.map((item) => {
    // Cada riego con fertilizante, con la dosis de su semana en la etapa.
    const stored = item.nutrition ? buildStoredMix(item.nutrition, sources.fertilizers, sources.combos, item.stageDays) : null
    const recipe = stored ? mixRecipe(stored.resolved, stored.week) : ''
    // "Otro" se llama como su nota; las demás propias llevan la nota de descripción.
    const isOther = item.type === 'otro' && item.note
    return {
      title: isOther ? item.note! : getTaskType(item.type).label,
      description: item.type === 'lavado' ? FLUSH_NOTE : recipe || (isOther ? null : item.note ?? null),
      // Mediodía: una fecha sin hora a las 00:00 se corre al día anterior.
      due_date: `${item.day}T12:00:00`,
      type: item.type,
      application_type: item.type === 'fertilizante' ? 'Riego' : null,
      target_stage: item.targetStage ?? null,
      target_space_id: null,
      recurrence_id: null,
      metadata: {
        targets,
        plan_id: planId,
        plan_cycle_id: cycleId,
        ...(stored ? { nutrition: stored } : {}),
      },
    }
  })

  const { error } = await supabase.rpc('create_tasks', {
    p_tasks: rows as unknown as Json,
    p_cycle_ids: [cycleId],
    p_plant_ids: plants.map((plant) => Number(plant.id)),
  })

  if (error) return { error: friendlyDbError(error, 'No se pudo crear el plan.', {}, 'Error creando el plan de cultivo:') }

  // El ciclo se queda con la meta del plan y, si todavía no florece, con el
  // pase previsto: así el panel, la agenda y el formulario cuentan igual.
  const { error: scheduleError } = await supabase
    .from('cycles')
    .update(stage === 'Floración'
      ? { flower_target_weeks: flowerWeeks }
      : { flower_target_weeks: flowerWeeks, planned_flower_start: plan.flowerStart })
    .eq('id', cycleId)
  if (scheduleError) console.error('Error guardando la meta del ciclo desde el plan:', scheduleError)

  revalidatePath('/')
  revalidatePath('/calendar')
  revalidatePath('/cycles/[id]', 'page')
  return { error: null, created: rows.length, truncated: plan.truncated }
}

/** Borra las tareas pendientes de los planes de un ciclo (las hechas quedan). */
export async function deleteGrowPlan(rawCycleId: number) {
  const cycleId = parseId(rawCycleId)
  if (!cycleId) return { error: 'Ese ciclo no es válido.' }

  const session = await requireUser()
  if ('error' in session) return { error: session.error }

  const { data, error } = await session.supabase
    .from('tasks')
    .delete()
    .eq('status', 'pending')
    .eq('metadata->>plan_cycle_id', String(cycleId))
    .select('id')

  if (error) return { error: friendlyDbError(error, 'No se pudo borrar el plan.', {}, 'Error borrando el plan:') }

  revalidatePath('/')
  revalidatePath('/calendar')
  revalidatePath('/cycles/[id]', 'page')
  return { error: null, deleted: data?.length ?? 0 }
}
