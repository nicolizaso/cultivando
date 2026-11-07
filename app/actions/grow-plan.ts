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
    vegNutrition: vegMix,
    flowerNutrition: flowerMix,
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
    // Cada riego con fertilizante, con la dosis de su semana en la etapa.
    const stored = item.nutrition ? buildStoredMix(item.nutrition, sources.fertilizers, sources.combos, item.stageDays) : null
    const recipe = stored ? mixRecipe(stored.resolved, stored.week) : ''
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
