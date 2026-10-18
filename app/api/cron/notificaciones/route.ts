import { NextResponse } from 'next/server'
import { createAdminClient } from '@/app/lib/supabase-admin'
import { buildDigest, readPrefs } from '@/app/lib/notifications'
import { loadDigestInput } from '@/app/lib/digest-data'
import { pushConfigured, sendPush } from '@/app/lib/push'
import { todayKey } from '@/app/lib/dates'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Tras tantos envíos fallidos seguidos, la suscripción se da por muerta. */
const MAX_FAILURES = 5

/**
 * El aviso diario. Lo llama el cron de Vercel (vercel.json) con
 * `Authorization: Bearer <CRON_SECRET>`; sin ese encabezado no hace nada.
 * Una vez por día por dispositivo: `last_sent_on` evita repetir si el cron
 * corre dos veces.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin || !pushConfigured()) {
    return NextResponse.json({ error: 'Faltan SUPABASE_SERVICE_ROLE_KEY o las claves VAPID.' }, { status: 500 })
  }

  const today = todayKey()
  const { data: subscriptions, error } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, prefs, failures, last_sent_on')
    .or(`last_sent_on.is.null,last_sent_on.lt.${today}`)
    .limit(1000)

  if (error) {
    console.error('Cron de avisos: no se pudieron leer las suscripciones', error)
    return NextResponse.json({ error: 'No se pudieron leer las suscripciones.' }, { status: 500 })
  }

  let sent = 0
  let skipped = 0
  let removed = 0

  // Por usuario: los datos del día se leen una vez aunque tenga varios dispositivos.
  const byUser = new Map<string, NonNullable<typeof subscriptions>>()
  for (const subscription of subscriptions ?? []) {
    byUser.set(subscription.user_id, [...(byUser.get(subscription.user_id) ?? []), subscription])
  }

  for (const [userId, list] of byUser) {
    const allOn = readPrefs(null)
    const base = await loadDigestInput(admin, userId, allOn)

    for (const subscription of list) {
      const digest = buildDigest({ ...base, prefs: readPrefs(subscription.prefs) }, today)
      if (!digest) {
        skipped++
        await admin.from('push_subscriptions').update({ last_sent_on: today }).eq('id', subscription.id)
        continue
      }

      const result = await sendPush(subscription, digest)
      if (result.gone || (!result.ok && subscription.failures + 1 >= MAX_FAILURES)) {
        removed++
        await admin.from('push_subscriptions').delete().eq('id', subscription.id)
      } else if (result.ok) {
        sent++
        await admin.from('push_subscriptions').update({ last_sent_on: today, failures: 0 }).eq('id', subscription.id)
      } else {
        await admin.from('push_subscriptions').update({ failures: subscription.failures + 1 }).eq('id', subscription.id)
      }
    }
  }

  return NextResponse.json({ sent, skipped, removed })
}
