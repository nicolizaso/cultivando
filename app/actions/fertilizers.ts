'use server'

import { revalidatePath } from "next/cache"
import { requireUser } from "@/app/lib/auth"
import { friendlyDbError } from "@/app/lib/errors"
import {
  DOSAGE_TYPES, DOSE_BASES, DOSE_UNITS, FERTILIZER_STAGES, MAX_DOSE, MAX_MIX_ITEMS, feedItems, mixLabel, parseWeeklyDosages,
  readBasis, readFeed, readStoredMix, readUnit,
} from "@/app/lib/nutrition"
import { INVALID, nullable, oneOf, optionalNumber, optionalText, parseDecimal, parseId, pickFields, requiredText } from "@/app/lib/sanitize"
import type { Parser } from "@/app/lib/sanitize"
import type { Fertilizer, FertilizerCombo, NutritionOptions } from "@/app/lib/types"

const FERTILIZER_COLUMNS = 'id, user_id, name, brand, stage_category, dosage_type, unit, dose_basis, fixed_dosage, weekly_dosages, stock_ml, container_ml, low_stock_ml, created_at'

const toNullableNumber = (value: unknown) => (value === null || value === undefined ? null : Number(value))

/** Fila de `fertilizers` → `Fertilizer`, con la tabla semanal depurada. */
function toFertilizer(row: Record<string, unknown>): Fertilizer {
  return {
    id: Number(row.id),
    user_id: (row.user_id as string | null) ?? null,
    name: String(row.name ?? ''),
    brand: (row.brand as string | null) ?? null,
    stage_category: (row.stage_category as Fertilizer['stage_category']) ?? null,
    dosage_type: (row.dosage_type as Fertilizer['dosage_type']) ?? null,
    unit: readUnit(row.unit),
    dose_basis: readBasis(row.dose_basis),
    fixed_dosage: row.fixed_dosage === null || row.fixed_dosage === undefined ? null : Number(row.fixed_dosage),
    weekly_dosages: row.weekly_dosages ? parseWeeklyDosages(row.weekly_dosages) : null,
    stock_ml: toNullableNumber(row.stock_ml),
    container_ml: toNullableNumber(row.container_ml),
    low_stock_ml: toNullableNumber(row.low_stock_ml),
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
  unit: oneOf(DOSE_UNITS),
  dose_basis: oneOf(DOSE_BASES),
  fixed_dosage: optionalNumber({ min: 0, max: MAX_DOSE }),
  weekly_dosages: weeklyDosages,
  container_ml: optionalNumber({ min: 1, max: 100000 }),
  low_stock_ml: optionalNumber({ min: 0, max: 100000 }),
}

/** El stock se escribe aparte: cada cambio deja su movimiento. */
const parseStock = optionalNumber({ min: 0, max: 1000000 })

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
    if (data.fixed_dosage === undefined || data.fixed_dosage === null) return { error: 'Cargá la dosis del producto.' as const }
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

type ComboRow = {
  id: number
  user_id: string | null
  name: string
  description: string | null
  created_at: string | null
  combo_items: { fertilizer_id: number; dose: number | null; fertilizers: { name: string } | { name: string }[] | null }[] | null
}

const COMBO_COLUMNS = 'id, user_id, name, description, created_at, combo_items ( fertilizer_id, dose, fertilizers ( name ) )'

function toCombo(row: ComboRow): FertilizerCombo {
  return {
    id: Number(row.id),
    user_id: row.user_id ?? null,
    name: row.name,
    description: row.description ?? null,
    created_at: row.created_at ?? null,
    products: (row.combo_items ?? []).map((item) => {
      const fertilizer = Array.isArray(item.fertilizers) ? item.fertilizers[0] : item.fertilizers
      return {
        fertilizer_id: Number(item.fertilizer_id),
        name: fertilizer?.name ?? 'Producto',
        dose: item.dose === null || item.dose === undefined ? null : Number(item.dose),
      }
    }),
  }
}

/**
 * Los combos con sus productos y la dosis propia de cada uno. Los productos
 * viven en `combo_items`: antes se leía una columna `products` que la tabla
 * no tiene, y todo combo se mostraba con "0 productos".
 */
export async function getFertilizerCombos() {
  const session = await requireUser()
  if ('error' in session) return { data: null, error: session.error }
  const { supabase, user } = session

  const { data, error } = await supabase
    .from('fertilizer_combos')
    .select(COMBO_COLUMNS)
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) {
    return { data: null, error: friendlyDbError(error, 'No se pudieron cargar los combos.', {}, 'Error leyendo combos:') }
  }

  return { data: ((data ?? []) as unknown as ComboRow[]).map(toCombo), error: null }
}

/**
 * Todo lo que necesita el selector de nutrientes en una sola llamada: los
 * productos, los combos y la última mezcla que se usó (de una tarea ya
 * pasada o de un riego con la calculadora), para repetirla con un toque.
 */
export async function getNutritionOptions(): Promise<{ data: NutritionOptions | null; error: string | null }> {
  const session = await requireUser()
  if ('error' in session) return { data: null, error: session.error }
  const { supabase, user } = session

  const [fertilizers, combos, lastTask, lastLog] = await Promise.all([
    supabase.from('fertilizers').select(FERTILIZER_COLUMNS).eq('user_id', user.id).order('name', { ascending: true }),
    supabase.from('fertilizer_combos').select(COMBO_COLUMNS).eq('user_id', user.id).order('name', { ascending: true }),
    supabase
      .from('tasks')
      .select('due_date, metadata')
      .eq('user_id', user.id)
      .eq('type', 'fertilizante')
      .not('metadata->nutrition', 'is', null)
      .lte('due_date', new Date().toISOString())
      .order('due_date', { ascending: false })
      .limit(5),
    supabase
      .from('logs')
      .select('data, created_at')
      .eq('user_id', user.id)
      .not('data->feed', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  if (fertilizers.error || combos.error) {
    return {
      data: null,
      error: friendlyDbError(fertilizers.error ?? combos.error, 'No se pudieron cargar los productos.', {}, 'Error leyendo la nutrición:'),
    }
  }

  const products = (fertilizers.data ?? []).map((row) => toFertilizer(row as Record<string, unknown>))
  const comboList = ((combos.data ?? []) as unknown as ComboRow[]).map(toCombo)
  const known = new Set(products.map((product) => product.id))

  // La más reciente entre la última tarea con mezcla y el último riego con calculadora.
  const candidates: NonNullable<NutritionOptions['lastMix']>[] = []
  for (const task of lastTask.data ?? []) {
    const mix = readStoredMix(task.metadata, comboList, products)
    if (!mix) continue
    candidates.push({ items: mix.items, label: mix.label || mixLabel(mix.items, comboList), date: task.due_date })
    break
  }
  const log = (lastLog.data ?? [])[0]
  const feed = log ? readFeed(log.data) : null
  if (feed && feed.items.length > 0 && log?.created_at) {
    candidates.push({ items: feedItems(feed), label: feed.label || mixLabel(feedItems(feed), comboList), date: log.created_at })
  }
  const latest = candidates.sort((a, b) => b.date.localeCompare(a.date))[0]
  const items = latest?.items.filter((item) => known.has(item.fertilizer_id)) ?? []

  return {
    data: {
      fertilizers: products,
      combos: comboList,
      lastMix: latest && items.length > 0 ? { ...latest, items, label: mixLabel(items, comboList) || latest.label } : null,
    },
    error: null,
  }
}

export async function createFertilizer(formData: unknown) {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase, user } = session

  const parsed = parseFertilizer(formData)
  if ('error' in parsed) return { error: parsed.error }

  const stock = parseStock((formData as { stock_ml?: unknown } | null)?.stock_ml)
  if (stock === INVALID) return { error: 'Revisá el stock: tiene que ser un número.' }

  const { data, error } = await supabase
    .from('fertilizers')
    .insert({ ...parsed.values, name: parsed.values.name!, user_id: user.id, stock_ml: stock })
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

  const rawStock = (formData as { stock_ml?: unknown } | null)?.stock_ml
  const stock = rawStock === undefined ? undefined : parseStock(rawStock)
  if (stock === INVALID) return { error: 'Revisá el stock: tiene que ser un número.' }

  const { data: current } = await supabase.from('fertilizers').select('stock_ml').eq('id', fertilizerId).maybeSingle()
  if (!current) return { error: 'No se encontró el producto.' }

  // Empezar o dejar de llevar la cuenta se escribe directo; cambiar un número
  // que ya existía pasa por la función, que deja el ajuste en el historial.
  const startsOrStops = stock !== undefined && (current.stock_ml === null || stock === null)
  const { error } = await supabase
    .from('fertilizers')
    .update({ ...parsed.values, ...(startsOrStops ? { stock_ml: stock } : {}) })
    .eq('id', fertilizerId)
    .eq('user_id', user.id)

  if (error) {
    return { error: friendlyDbError(error, 'Error al actualizar el fertilizante.', {}, 'Error updating fertilizer:') }
  }

  if (stock !== undefined && stock !== null && current.stock_ml !== null && Number(current.stock_ml) !== stock) {
    const { error: stockError } = await supabase.rpc('move_fertilizer_stock', {
      p_changes: [{ fertilizer_id: fertilizerId, delta_ml: stock - Number(current.stock_ml) }],
      p_reason: 'ajuste',
    })
    if (stockError) return { error: friendlyDbError(stockError, 'Se guardó el producto pero no el stock.', {}, 'Error ajustando el stock:') }
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

/** [{ fertilizer_id, dose }] del cliente: ids válidos sin repetir y dosis entre 0 y 1000 (o vacía). */
function parseComboItems(value: unknown): { fertilizer_id: number; dose: number | null }[] | null {
  if (!Array.isArray(value) || value.length > MAX_MIX_ITEMS) return null
  const seen = new Set<number>()
  const items: { fertilizer_id: number; dose: number | null }[] = []
  for (const raw of value) {
    const id = parseId((raw as { fertilizer_id?: unknown })?.fertilizer_id)
    if (!id) return null
    if (seen.has(id)) continue
    seen.add(id)
    const rawDose = (raw as { dose?: unknown })?.dose
    const dose = rawDose === null || rawDose === undefined || rawDose === '' ? null : parseDecimal(rawDose)
    if (dose !== null && (dose === undefined || !Number.isFinite(dose) || dose < 0 || dose > MAX_DOSE)) return null
    items.push({ fertilizer_id: id, dose: dose === null ? null : Math.round(dose * 100) / 100 })
  }
  return items
}

/**
 * Crea o reescribe un combo con sus productos (y la dosis propia de cada uno)
 * en una sola transacción (`save_fertilizer_combo_items`). Antes la edición
 * borraba la descripción del combo, porque el formulario no la mandaba.
 */
async function saveCombo(comboId: number | null, formData: unknown) {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase } = session

  const input = (formData ?? {}) as { name?: unknown; description?: unknown; items?: unknown }
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 80) : ''
  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 500) || null : null
  const items = parseComboItems(input.items)

  if (!name) return { error: 'Completá el nombre del combo.' }
  if (!items) return { error: 'Revisá las dosis: tienen que ser números entre 0 y 1000.' }
  if (items.length === 0) return { error: 'Elegí al menos un producto.' }

  const { data, error } = await supabase.rpc('save_fertilizer_combo_items', {
    p_combo_id: comboId,
    p_name: name,
    p_description: description,
    p_items: items,
  })

  if (error) {
    return {
      error: friendlyDbError(error, 'No se pudo guardar el combo.', {
        P0002: 'No se encontró el combo.',
        '23503': 'Alguno de los productos ya no existe.',
        '23514': 'Revisá el nombre, los productos y las dosis del combo.',
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

/**
 * Suma una compra al stock: lo que se indique o, si no, un envase entero.
 */
export async function restockFertilizer(id: number, rawMl?: unknown) {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase } = session

  const fertilizerId = parseId(id)
  if (!fertilizerId) return { error: 'Ese producto no es válido.' }

  const { data: fertilizer } = await supabase.from('fertilizers').select('stock_ml, container_ml').eq('id', fertilizerId).maybeSingle()
  if (!fertilizer) return { error: 'No se encontró el producto.' }

  const parsedMl = rawMl === undefined || rawMl === '' ? null : parseStock(rawMl)
  if (parsedMl === INVALID) return { error: 'Revisá la cantidad: tiene que ser un número.' }
  const ml = parsedMl ?? (fertilizer.container_ml === null ? null : Number(fertilizer.container_ml))
  if (!ml || ml <= 0) return { error: 'Decí cuánto compraste.' }

  if (fertilizer.stock_ml === null) {
    // Primera compra registrada: arranca la cuenta con eso.
    const { error } = await supabase.from('fertilizers').update({ stock_ml: ml }).eq('id', fertilizerId)
    if (error) return { error: friendlyDbError(error, 'No se pudo sumar la compra.', {}, 'Error iniciando el stock:') }
  } else {
    const { error } = await supabase.rpc('move_fertilizer_stock', {
      p_changes: [{ fertilizer_id: fertilizerId, delta_ml: ml }],
      p_reason: 'compra',
    })
    if (error) return { error: friendlyDbError(error, 'No se pudo sumar la compra.', {}, 'Error sumando la compra:') }
  }

  revalidatePath('/fertilizers')
  revalidatePath('/')
  return { error: null, added: ml }
}
