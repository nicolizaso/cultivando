'use server'

import { revalidatePath } from "next/cache"
import { requireUser } from "@/app/lib/auth"
import { friendlyDbError } from "@/app/lib/errors"
import { DOSAGE_TYPES, FERTILIZER_STAGES, parseWeeklyDosages } from "@/app/lib/nutrition"
import { INVALID, nullable, oneOf, optionalNumber, optionalText, parseId, parseIds, pickFields, requiredText } from "@/app/lib/sanitize"
import type { Parser } from "@/app/lib/sanitize"
import type { Fertilizer, FertilizerCombo } from "@/app/lib/types"

const FERTILIZER_COLUMNS = 'id, user_id, name, brand, stage_category, dosage_type, fixed_dosage, weekly_dosages, created_at'

/** Fila de `fertilizers` → `Fertilizer`, con la tabla semanal depurada. */
function toFertilizer(row: Record<string, unknown>): Fertilizer {
  return {
    id: Number(row.id),
    user_id: (row.user_id as string | null) ?? null,
    name: String(row.name ?? ''),
    brand: (row.brand as string | null) ?? null,
    stage_category: (row.stage_category as Fertilizer['stage_category']) ?? null,
    dosage_type: (row.dosage_type as Fertilizer['dosage_type']) ?? null,
    fixed_dosage: row.fixed_dosage === null || row.fixed_dosage === undefined ? null : Number(row.fixed_dosage),
    weekly_dosages: row.weekly_dosages ? parseWeeklyDosages(row.weekly_dosages) : null,
    created_at: (row.created_at as string | null) ?? null,
  }
}

const weeklyDosages: Parser<ReturnType<typeof parseWeeklyDosages> | null> = (value) => {
  if (value === null) return null
  if (!Array.isArray(value)) return INVALID
  const table = parseWeeklyDosages(value)
  return table.length === value.length ? table : INVALID
}

/** Los campos que se pueden escribir de un fertilizante, con su formato. */
const FERTILIZER_FIELDS = {
  name: requiredText(80),
  brand: optionalText(80),
  stage_category: nullable(oneOf(FERTILIZER_STAGES)),
  dosage_type: oneOf(DOSAGE_TYPES),
  fixed_dosage: optionalNumber({ min: 0, max: 1000 }),
  weekly_dosages: weeklyDosages,
}

/**
 * Valida un fertilizante completo: además de cada campo, que la dosis tenga
 * sentido para su tipo (fija con número, semanal con al menos una semana).
 */
function parseFertilizer(input: unknown) {
  const { data, invalid } = pickFields(input, FERTILIZER_FIELDS)
  if (invalid.length > 0) return { error: 'Revisá los datos del producto: hay valores que no se entienden.' as const }
  if (!data.name) return { error: 'El producto necesita un nombre.' as const }

  const dosageType = data.dosage_type ?? 'fija'
  if (dosageType === 'fija') {
    if (data.fixed_dosage === undefined || data.fixed_dosage === null) return { error: 'Cargá la dosis en ml por litro.' as const }
    return { values: { ...data, dosage_type: dosageType, weekly_dosages: null } }
  }

  if (!data.weekly_dosages || data.weekly_dosages.length === 0) return { error: 'Cargá al menos una semana en la tabla.' as const }
  return { values: { ...data, dosage_type: dosageType, fixed_dosage: null } }
}

export async function getFertilizers() {
  const session = await requireUser()
  if ('error' in session) return { data: null, error: session.error }
  const { supabase, user } = session

  const { data, error } = await supabase
    .from('fertilizers')
    .select(FERTILIZER_COLUMNS)
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) {
    return { data: null, error: friendlyDbError(error, 'No se pudieron cargar los productos.', {}, 'Error leyendo fertilizantes:') }
  }

  return { data: (data ?? []).map((row) => toFertilizer(row as Record<string, unknown>)), error: null }
}

/**
 * Los combos con sus productos. Los productos viven en `combo_items`: antes se
 * leía una columna `products` que la tabla no tiene, y todo combo se mostraba
 * con "0 productos".
 */
export async function getFertilizerCombos() {
  const session = await requireUser()
  if ('error' in session) return { data: null, error: session.error }
  const { supabase, user } = session

  const { data, error } = await supabase
    .from('fertilizer_combos')
    .select('id, user_id, name, description, created_at, combo_items ( fertilizer_id, fertilizers ( name ) )')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) {
    return { data: null, error: friendlyDbError(error, 'No se pudieron cargar los combos.', {}, 'Error leyendo combos:') }
  }

  const combos: FertilizerCombo[] = (data ?? []).map((row) => {
    const items = (row.combo_items ?? []) as { fertilizer_id: number; fertilizers: { name: string } | { name: string }[] | null }[]
    return {
      id: Number(row.id),
      user_id: row.user_id ?? null,
      name: row.name,
      description: row.description ?? null,
      created_at: row.created_at ?? null,
      products: items.map((item) => {
        const fertilizer = Array.isArray(item.fertilizers) ? item.fertilizers[0] : item.fertilizers
        return { fertilizer_id: Number(item.fertilizer_id), name: fertilizer?.name ?? 'Producto' }
      }),
    }
  })

  return { data: combos, error: null }
}

export async function createFertilizer(formData: unknown) {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase, user } = session

  const parsed = parseFertilizer(formData)
  if ('error' in parsed) return { error: parsed.error }

  const { data, error } = await supabase
    .from('fertilizers')
    .insert({ ...parsed.values, name: parsed.values.name!, user_id: user.id })
    .select(FERTILIZER_COLUMNS)
    .single()

  if (error || !data) {
    return { error: friendlyDbError(error, 'Error al crear el fertilizante.', {}, 'Error creating fertilizer:') }
  }

  revalidatePath('/fertilizers')
  return { data: toFertilizer(data as Record<string, unknown>), error: null }
}

export async function updateFertilizer(id: number, formData: unknown) {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase, user } = session

  const fertilizerId = parseId(id)
  if (!fertilizerId) return { error: 'Ese producto no es válido.' }

  const parsed = parseFertilizer(formData)
  if ('error' in parsed) return { error: parsed.error }

  const { error } = await supabase
    .from('fertilizers')
    .update(parsed.values)
    .eq('id', fertilizerId)
    .eq('user_id', user.id)

  if (error) {
    return { error: friendlyDbError(error, 'Error al actualizar el fertilizante.', {}, 'Error updating fertilizer:') }
  }

  revalidatePath('/fertilizers')
  return { error: null }
}

export async function deleteFertilizer(id: number) {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase, user } = session

  const fertilizerId = parseId(id)
  if (!fertilizerId) return { error: 'Ese producto no es válido.' }

  const { error } = await supabase
    .from('fertilizers')
    .delete()
    .eq('id', fertilizerId)
    .eq('user_id', user.id)

  if (error) {
    return { error: friendlyDbError(error, 'Error al eliminar el fertilizante.', {}, 'Error deleting fertilizer:') }
  }

  revalidatePath('/fertilizers')
  return { error: null }
}

/**
 * Crea o reescribe un combo con sus productos en una sola transacción
 * (`save_fertilizer_combo`). Antes se creaba el combo y después sus
 * productos: si lo segundo fallaba quedaba un combo vacío, y la edición
 * intentaba escribir una columna `products` que no existe.
 */
async function saveCombo(comboId: number | null, formData: unknown) {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase } = session

  const input = (formData ?? {}) as { name?: unknown; description?: unknown; products?: { fertilizer_id?: unknown }[] }
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 80) : ''
  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 500) || null : null
  const fertilizerIds = parseIds(Array.isArray(input.products) ? input.products.map((p) => p?.fertilizer_id) : [])

  if (!name) return { error: 'Completá el nombre del combo.' }
  if (fertilizerIds.length === 0) return { error: 'Elegí al menos un producto.' }

  const { data, error } = await supabase.rpc('save_fertilizer_combo', {
    p_combo_id: comboId,
    p_name: name,
    p_description: description,
    p_fertilizer_ids: fertilizerIds,
  })

  if (error) {
    return {
      error: friendlyDbError(error, 'No se pudo guardar el combo.', {
        P0002: 'No se encontró el combo.',
        '23503': 'Alguno de los productos ya no existe.',
      }, 'Error guardando combo:'),
    }
  }

  revalidatePath('/fertilizers')
  return { data: { id: Number(data) }, error: null }
}

export async function createFertilizerCombo(formData: unknown) {
  return saveCombo(null, formData)
}

export async function updateFertilizerCombo(id: number, formData: unknown) {
  const comboId = parseId(id)
  if (!comboId) return { error: 'Ese combo no es válido.' }
  return saveCombo(comboId, formData)
}

export async function deleteFertilizerCombo(id: number) {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase, user } = session

  const comboId = parseId(id)
  if (!comboId) return { error: 'Ese combo no es válido.' }

  const { error } = await supabase
    .from('fertilizer_combos')
    .delete()
    .eq('id', comboId)
    .eq('user_id', user.id)

  if (error) {
    return { error: friendlyDbError(error, 'Error al eliminar el combo.', {}, 'Error deleting combo:') }
  }

  revalidatePath('/fertilizers')
  return { error: null }
}
