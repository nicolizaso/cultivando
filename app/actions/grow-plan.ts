'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/app/lib/auth'
import { friendlyDbError } from '@/app/lib/errors'
import { getTaskType } from '@/app/lib/constants'
import { dominantStage, stagePeriods } from '@/app/lib/climate'
import { dateKey, todayKey } from '@/app/lib/dates'
import { buildGrowPlan } from '@/app/lib/grow-plan'
import type { GrowPlanOptions } from '@/app/lib/grow-plan'
import { buildRecipe, recipeItems } from '@/app/lib/nutrition'
import type { ComboInfo, FertilizerDoseInfo, NutritionSelection } from '@/app/lib/nutrition'
import { parseId } from '@/app/lib/sanitize'
import type { Json } from '@/app/lib/database.types'

const PLANT_COLUMNS =
  'id, stage, is_archived, stage_updated_at, date_germinacion, date_plantula, date_enraizamiento, date_vegetativo, date_floracion, date_secado, date_curado' as const

function readSelection(value: unknown): NutritionSelection | null {
  const type = (value as { type?: unknown } | null)?.type
  const id = parseId((value as { id?: unknown } | null)?.id)
  return (type === 'product' || type === 'combo') && id ? { type, id } : null
}

const num = (value: unknown, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
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

  const [{ data: cycle }, { data: plants }, { data: fertilizers }, { data: combos }] = await Promise.all([
    supabase.from('cycles').select('id, is_active').eq('id', cycleId).maybeSingle(),
    supabase.from('plants').select(PLANT_COLUMNS).eq('cycle_id', cycleId).eq('is_archived', false),
    supabase.from('fertilizers').select('id, name, dosage_type, fixed_dosage, weekly_dosages').eq('user_id', user.id),
    supabase.from('fertilizer_combos').select('id, combo_items ( fertilizer_id, fertilizers ( name ) )').eq('user_id', user.id),
  ])

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

  const comboInfos: ComboInfo[] = (combos ?? []).map((combo) => ({
    id: Number(combo.id),
    products: ((combo.combo_items ?? []) as { fertilizer_id: number; fertilizers: { name: string } | { name: string }[] | null }[]).map((item) => {
      const fertilizer = Array.isArray(item.fertilizers) ? item.fertilizers[0] : item.fertilizers
      return { fertilizer_id: Number(item.fertilizer_id), name: fertilizer?.name ?? 'Producto' }
    }),
  }))
  const doseInfos = (fertilizers ?? []) as FertilizerDoseInfo[]

  const owned = (selection: NutritionSelection | null) =>
    selection && (selection.type === 'product'
      ? doseInfos.some((f) => Number(f.id) === selection.id)
      : comboInfos.some((c) => c.id === selection.id))
      ? selection
      : null

  const raw = (rawOptions ?? {}) as Record<string, unknown>
  const include = (raw.include ?? {}) as Record<string, unknown>
  const options: GrowPlanOptions = {
    today: todayKey(),
    currentStage: stage,
    stageStart,
    vegDays: num(raw.vegDays, 35),
    flowerDays: num(raw.flowerDays, 63),
    waterEvery: num(raw.waterEvery, 3),
    feedEvery: num(raw.feedEvery, 2),
    flushDays: num(raw.flushDays, 10),
    vegNutrition: owned(readSelection(raw.vegNutrition)),
    flowerNutrition: owned(readSelection(raw.flowerNutrition)),
    include: { stageChange: include.stageChange !== false, harvest: include.harvest !== false, flush: include.flush !== false },
  }

  const plan = buildGrowPlan(options)
  if (!plan) return { error: 'El ciclo ya está cosechado: no hay plan que armar.' }

  const excluded = new Set(Array.isArray(excludedKeys) ? excludedKeys.filter((key): key is string => typeof key === 'string') : [])
  const items = plan.items.filter((item) => !excluded.has(item.key))
  if (items.length === 0) return { error: 'No quedó ninguna tarea para crear.' }

  const planId = randomUUID()
  const targets = { cycle_ids: [cycleId], plant_ids: [] as number[] }
  const rows = items.map((item) => {
    const recipe = item.nutrition
      ? buildRecipe(recipeItems(item.nutrition, doseInfos, comboInfos, item.week), item.week)
      : ''
    return {
      title: getTaskType(item.type).label,
      description: item.type === 'lavado' ? FLUSH_NOTE : recipe || null,
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
        ...(item.nutrition ? { nutrition: { ...item.nutrition, week: item.week } } : {}),
      },
    }
  })

  const { error } = await supabase.rpc('create_tasks', {
    p_tasks: rows as unknown as Json,
    p_cycle_ids: [cycleId],
    p_plant_ids: plants.map((plant) => Number(plant.id)),
  })

  if (error) return { error: friendlyDbError(error, 'No se pudo crear el plan.', {}, 'Error creando el plan de cultivo:') }

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
