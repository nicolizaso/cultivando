'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/app/lib/auth'
import { friendlyDbError } from '@/app/lib/errors'
import { parseId } from '@/app/lib/sanitize'

/**
 * El enlace para compartir un ciclo en modo lectura. Si ya hay uno activo
 * devuelve ese: compartir dos veces no genera dos enlaces.
 */
export async function getOrCreateCycleShare(rawCycleId: number) {
  const cycleId = parseId(rawCycleId)
  if (!cycleId) return { error: 'Ese ciclo no es válido.' }

  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  const { supabase } = session

  const { data: existing } = await supabase
    .from('cycle_shares')
    .select('token')
    .eq('cycle_id', cycleId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) return { error: null, token: existing.token }

  // 24 bytes al azar → 32 caracteres que no se pueden adivinar.
  const token = randomBytes(24).toString('base64url')
  const { error } = await supabase.from('cycle_shares').insert({ cycle_id: cycleId, token })
  if (error) return { error: friendlyDbError(error, 'No se pudo crear el enlace.', {}, 'Error creando el enlace del ciclo:') }

  revalidatePath('/cycles/[id]', 'page')
  return { error: null, token }
}

/** Corta el enlace: quien lo tenga deja de ver el ciclo. */
export async function revokeCycleShare(rawCycleId: number) {
  const cycleId = parseId(rawCycleId)
  if (!cycleId) return { error: 'Ese ciclo no es válido.' }

  const session = await requireUser()
  if ('error' in session) return { error: session.error }

  const { error } = await session.supabase
    .from('cycle_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('cycle_id', cycleId)
    .is('revoked_at', null)

  if (error) return { error: friendlyDbError(error, 'No se pudo cortar el enlace.', {}, 'Error revocando el enlace:') }

  revalidatePath('/cycles/[id]', 'page')
  return { error: null }
}
