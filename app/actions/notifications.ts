'use server'

import { requireUser } from '@/app/lib/auth'
import { friendlyDbError } from '@/app/lib/errors'
import { buildDigest, readPrefs } from '@/app/lib/notifications'
import type { NotificationPrefs } from '@/app/lib/notifications'
import { loadDigestInput } from '@/app/lib/digest-data'
import { pushConfigured, sendPush } from '@/app/lib/push'
import { todayKey } from '@/app/lib/dates'

function readSubscription(value: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  const raw = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null
  const endpoint = typeof raw?.endpoint === 'string' ? raw.endpoint : ''
  const p256dh = typeof raw?.keys?.p256dh === 'string' ? raw.keys.p256dh : ''
  const auth = typeof raw?.keys?.auth === 'string' ? raw.keys.auth : ''
  if (!endpoint.startsWith('https://') || endpoint.length > 1000 || !p256dh || p256dh.length > 200 || !auth || auth.length > 100) return null
  return { endpoint, p256dh, auth }
}

/** Guarda la suscripción de este dispositivo (o la actualiza si ya estaba). */
export async function savePushSubscription(rawSubscription: unknown, userAgent?: string) {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  if (!pushConfigured()) return { error: 'Las notificaciones todavía no están configuradas en el servidor.' }

  const subscription = readSubscription(rawSubscription)
  if (!subscription) return { error: 'La suscripción del navegador no es válida.' }

  const { error } = await session.supabase.from('push_subscriptions').upsert(
    { ...subscription, user_id: session.user.id, user_agent: typeof userAgent === 'string' ? userAgent.slice(0, 300) : null, failures: 0 },
    { onConflict: 'endpoint' }
  )
  if (error) return { error: friendlyDbError(error, 'No se pudo activar las notificaciones.', {}, 'Error guardando la suscripción push:') }
  return { error: null }
}

export async function deletePushSubscription(endpoint: unknown) {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  if (typeof endpoint !== 'string') return { error: 'Suscripción inválida.' }

  const { error } = await session.supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) return { error: friendlyDbError(error, 'No se pudo desactivar.', {}, 'Error borrando la suscripción push:') }
  return { error: null }
}

/** Qué avisos recibe este dispositivo. */
export async function getPushPrefs(endpoint: unknown) {
  const session = await requireUser()
  if ('error' in session) return { error: session.error, prefs: null }
  if (typeof endpoint !== 'string') return { error: null, prefs: null }
  const { data } = await session.supabase.from('push_subscriptions').select('prefs').eq('endpoint', endpoint).maybeSingle()
  return { error: null, prefs: data ? readPrefs(data.prefs) : null }
}

export async function updatePushPrefs(endpoint: unknown, rawPrefs: unknown) {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  if (typeof endpoint !== 'string') return { error: 'Suscripción inválida.' }
  const prefs: NotificationPrefs = readPrefs(rawPrefs)
  const { error } = await session.supabase.from('push_subscriptions').update({ prefs: { ...prefs } }).eq('endpoint', endpoint)
  if (error) return { error: friendlyDbError(error, 'No se pudieron guardar las preferencias.', {}, 'Error guardando preferencias push:') }
  return { error: null }
}

/** Manda ahora el aviso del día a este dispositivo (o uno de prueba si no hay nada). */
export async function sendTestNotification(endpoint: unknown) {
  const session = await requireUser()
  if ('error' in session) return { error: session.error }
  if (!pushConfigured()) return { error: 'Las notificaciones todavía no están configuradas en el servidor.' }
  if (typeof endpoint !== 'string') return { error: 'Suscripción inválida.' }

  const { data: subscription } = await session.supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, prefs')
    .eq('endpoint', endpoint)
    .maybeSingle()
  if (!subscription) return { error: 'Este dispositivo no está suscripto.' }

  const input = await loadDigestInput(session.supabase, session.user.id, readPrefs(subscription.prefs))
  const digest = buildDigest(input, todayKey()) ?? {
    title: 'Cultivando',
    body: 'Las notificaciones funcionan. Por hoy no hay nada que avisar.',
    url: '/',
    tag: 'prueba',
  }
  const result = await sendPush(subscription, digest)
  if (result.gone) {
    await session.supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    return { error: 'El navegador ya no acepta avisos: volvé a activarlos.' }
  }
  return result.ok ? { error: null } : { error: 'No se pudo mandar el aviso.' }
}
