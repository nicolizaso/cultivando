'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/app/lib/auth'
import { friendlyDbError } from '@/app/lib/errors'
import { parseHarvestInput } from '@/app/lib/harvest'
import { parseId } from '@/app/lib/sanitize'
import { bulkChangeStage } from './plants'

function revalidateHarvestViews() {
  revalidatePath('/plants/[id]', 'page')
  revalidatePath('/cycles/[id]', 'page')
  revalidatePath('/strains')
  revalidatePath('/plants')
}

/**
 * Guarda la cosecha de una planta (crea o reescribe). Con `moveToDrying`, si
 * la planta todavía no está en secado pasa a Secado con la fecha de cosecha:
 * es el mismo momento.
 */
export async function saveHarvest(rawPlantId: number, input: unknown, options: { moveToDrying?: boolean } = {}) {
  const plantId = parseId(rawPlantId)
  if (!plantId) return { error: 'Esa planta no es válida.' }

  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase } = session

  const parsed = parseHarvestInput(input)
  if (parsed.error !== null) return { error: parsed.error }

  const { data: plant } = await supabase.from('plants').select('id, cycle_id, stage, date_secado').eq('id', plantId).maybeSingle()
  if (!plant) return { error: 'No se encontró la planta.' }

  const { data: existing } = await supabase.from('harvests').select('cycle_id').eq('plant_id', plantId).maybeSingle()

  const { error } = await supabase.from('harvests').upsert(
    {
      plant_id: plantId,
      // El ciclo queda el de la primera vez: si después la planta se mueve,
      // la cosecha sigue contando para el ciclo donde se hizo.
      cycle_id: existing ? existing.cycle_id : plant.cycle_id,
      ...parsed.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'plant_id' }
  )

  if (error) return { error: friendlyDbError(error, 'No se pudo guardar la cosecha.', {}, 'Error guardando la cosecha:') }

  if (options.moveToDrying && !plant.date_secado && plant.stage !== 'Secado' && plant.stage !== 'Curado') {
    const moved = await bulkChangeStage([plantId], 'Secado', parsed.data.harvested_on)
    if (!moved.success) console.error('No se pudo pasar la planta a secado:', moved.error)
  }

  revalidateHarvestViews()
  return { error: null }
}

export async function deleteHarvest(rawPlantId: number) {
  const plantId = parseId(rawPlantId)
  if (!plantId) return { error: 'Esa planta no es válida.' }

  const session = await requireUser()
  if ('error' in session) return { error: session.error }

  const { error } = await session.supabase.from('harvests').delete().eq('plant_id', plantId)
  if (error) return { error: friendlyDbError(error, 'No se pudo borrar la cosecha.', {}, 'Error borrando la cosecha:') }

  revalidateHarvestViews()
  return { error: null }
}

/**
 * Pesos de varias plantas de un ciclo de una vez (la balanza al lado y una
 * planta atrás de otra). Las filas sin ningún peso se saltean; las que ya
 * tenían cosecha conservan su fecha.
 */
export async function saveCycleHarvests(
  rawCycleId: number,
  rows: unknown,
  harvestedOn: string,
  options: { moveToDrying?: boolean } = {}
) {
  const cycleId = parseId(rawCycleId)
  if (!cycleId) return { error: 'Ese ciclo no es válido.' }
  if (!Array.isArray(rows)) return { error: 'No hay pesos para guardar.' }

  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase } = session

  const plantIds = rows.map((row) => parseId((row as { plant_id?: unknown })?.plant_id)).filter((id): id is number => Boolean(id))
  const [{ data: plants }, { data: existing }] = await Promise.all([
    supabase.from('plants').select('id, cycle_id, stage, date_secado').in('id', plantIds),
    supabase.from('harvests').select('plant_id, cycle_id, harvested_on, dried_on, rating, notes').in('plant_id', plantIds),
  ])

  const plantById = new Map((plants ?? []).map((plant) => [Number(plant.id), plant]))
  const existingById = new Map((existing ?? []).map((row) => [Number(row.plant_id), row]))

  const upserts = []
  const toDry: number[] = []
  for (const row of rows as Record<string, unknown>[]) {
    const plantId = parseId(row?.plant_id)
    const plant = plantId ? plantById.get(plantId) : undefined
    if (!plantId || !plant) continue
    const empty = (value: unknown) => value === null || value === undefined || value === ''
    if (empty(row.wet_g) && empty(row.dry_g)) continue

    const previous = existingById.get(plantId)
    const parsed = parseHarvestInput({
      harvested_on: previous?.harvested_on ?? harvestedOn,
      dried_on: previous?.dried_on ?? null,
      wet_g: row.wet_g,
      dry_g: row.dry_g,
      rating: previous?.rating ?? null,
      notes: previous?.notes ?? null,
    })
    if (parsed.error !== null) return { error: parsed.error }

    upserts.push({
      plant_id: plantId,
      cycle_id: previous ? previous.cycle_id : (plant.cycle_id ?? cycleId),
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    if (!plant.date_secado && plant.stage !== 'Secado' && plant.stage !== 'Curado') toDry.push(plantId)
  }

  if (upserts.length === 0) return { error: 'Cargá al menos un peso.' }

  const { error } = await supabase.from('harvests').upsert(upserts, { onConflict: 'plant_id' })
  if (error) return { error: friendlyDbError(error, 'No se pudieron guardar las cosechas.', {}, 'Error guardando cosechas del ciclo:') }

  if (options.moveToDrying && toDry.length > 0) {
    const moved = await bulkChangeStage(toDry, 'Secado', harvestedOn)
    if (!moved.success) console.error('No se pudieron pasar las plantas a secado:', moved.error)
  }

  revalidateHarvestViews()
  return { error: null, saved: upserts.length }
}
