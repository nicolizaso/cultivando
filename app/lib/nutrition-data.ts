/**
 * Lo que las Server Actions leen de la base para armar una mezcla: los
 * productos del usuario (con su dosis, unidad y etapa) y sus combos (con la
 * dosis propia de cada producto). Lo usan las tareas, el riego y el plan.
 */
import 'server-only'
import type { ServerSupabase } from './auth'
import type { ComboInfo, FertilizerDoseInfo, MixItem } from './nutrition'

export interface MixSources {
  fertilizers: FertilizerDoseInfo[]
  combos: ComboInfo[]
}

type ComboRow = {
  id: number
  name: string
  combo_items: { fertilizer_id: number; dose: number | null; fertilizers: { name: string } | { name: string }[] | null }[] | null
}

export async function loadMixSources(supabase: ServerSupabase, userId: string): Promise<MixSources | { error: string }> {
  const [fertilizers, combos] = await Promise.all([
    supabase
      .from('fertilizers')
      .select('id, name, dosage_type, fixed_dosage, weekly_dosages, unit, dose_basis, stage_category')
      .eq('user_id', userId),
    supabase
      .from('fertilizer_combos')
      .select('id, name, combo_items ( fertilizer_id, dose, fertilizers ( name ) )')
      .eq('user_id', userId),
  ])

  if (fertilizers.error || combos.error) {
    console.error('No se pudieron leer los productos para la mezcla:', fertilizers.error ?? combos.error)
    return { error: 'No se pudieron leer tus productos.' }
  }

  return {
    fertilizers: (fertilizers.data ?? []).map((row) => ({
      ...row,
      id: Number(row.id),
      fixed_dosage: row.fixed_dosage === null ? null : Number(row.fixed_dosage),
    })) as FertilizerDoseInfo[],
    combos: ((combos.data ?? []) as unknown as ComboRow[]).map((combo) => ({
      id: Number(combo.id),
      name: combo.name,
      products: (combo.combo_items ?? []).map((item) => {
        const fertilizer = Array.isArray(item.fertilizers) ? item.fertilizers[0] : item.fertilizers
        return {
          fertilizer_id: Number(item.fertilizer_id),
          name: fertilizer?.name ?? 'Producto',
          dose: item.dose === null || item.dose === undefined ? null : Number(item.dose),
        }
      }),
    })),
  }
}

/** ¿Todos los productos de la mezcla son del usuario? */
export function ownsAll(items: MixItem[], fertilizers: FertilizerDoseInfo[]): boolean {
  const owned = new Set(fertilizers.map((fertilizer) => Number(fertilizer.id)))
  return items.every((item) => owned.has(Number(item.fertilizer_id)))
}
