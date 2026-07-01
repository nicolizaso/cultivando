'use server'

import { createClient } from "../lib/supabase-server"
import { revalidatePath } from "next/cache"
import { Fertilizer, FertilizerCombo } from "../lib/types"

export async function getFertilizers() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Debes iniciar sesión.' }

  const { data, error } = await supabase
    .from('fertilizers')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching fertilizers:', error)
    return { data: null, error: 'Error al cargar los fertilizantes.' }
  }

  return { data: data as Fertilizer[], error: null }
}

export async function getFertilizerCombos() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Debes iniciar sesión.' }

  const { data, error } = await supabase
    .from('fertilizer_combos')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching combos:', error)
    return { data: null, error: 'Error al cargar los combos.' }
  }

  return { data: data as FertilizerCombo[], error: null }
}

export async function createFertilizer(formData: Partial<Fertilizer>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Debes iniciar sesión.' }

  const { data, error } = await supabase
    .from('fertilizers')
    .insert([{ ...formData, user_id: user.id }])
    .select()

  if (error) {
    console.error('Error creating fertilizer:', error)
    return { error: 'Error al crear el fertilizante.' }
  }

  revalidatePath('/fertilizers')
  return { data: data[0], error: null }
}

export async function updateFertilizer(id: number, formData: Partial<Fertilizer>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Debes iniciar sesión.' }

  const { error } = await supabase
    .from('fertilizers')
    .update(formData)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error updating fertilizer:', error)
    return { error: 'Error al actualizar el fertilizante.' }
  }

  revalidatePath('/fertilizers')
  return { error: null }
}

export async function deleteFertilizer(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Debes iniciar sesión.' }

  const { error } = await supabase
    .from('fertilizers')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting fertilizer:', error)
    return { error: 'Error al eliminar el fertilizante.' }
  }

  revalidatePath('/fertilizers')
  return { error: null }
}

export async function createFertilizerCombo(formData: Partial<FertilizerCombo>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Debes iniciar sesión.' }

  const { data, error } = await supabase
    .from('fertilizer_combos')
    .insert([{ ...formData, user_id: user.id }])
    .select()

  if (error) {
    console.error('Error creating combo:', error)
    return { error: 'Error al crear el combo.' }
  }

  revalidatePath('/fertilizers')
  return { data: data[0], error: null }
}

export async function deleteFertilizerCombo(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Debes iniciar sesión.' }

  const { error } = await supabase
    .from('fertilizer_combos')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting combo:', error)
    return { error: 'Error al eliminar el combo.' }
  }

  revalidatePath('/fertilizers')
  return { error: null }
}

export async function updateFertilizerCombo(id: number, formData: Partial<FertilizerCombo>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Debes iniciar sesión.' }

  const { error } = await supabase
    .from('fertilizer_combos')
    .update(formData)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error updating combo:', error)
    return { error: 'Error al actualizar el combo.' }
  }

  revalidatePath('/fertilizers')
  return { error: null }
}
