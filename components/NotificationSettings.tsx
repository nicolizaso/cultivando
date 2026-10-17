'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2, Send } from 'lucide-react'
import { deletePushSubscription, getPushPrefs, savePushSubscription, sendTestNotification, updatePushPrefs } from '@/app/actions/notifications'
import { DEFAULT_PREFS, PREF_LABELS } from '@/app/lib/notifications'
import type { NotificationPrefs } from '@/app/lib/notifications'
import { useToast } from '@/app/context/ToastContext'
import Modal from '@/components/ui/Modal'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

/** La clave pública VAPID viene en base64url; PushManager la quiere en bytes. */
function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

type Status = 'loading' | 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on'

/**
 * Activar los avisos en este dispositivo: un resumen por la mañana con las
 * tareas del día, las atrasadas, el VPD fuera de rango y el stock bajo. En
 * iPhone sólo funciona con la app instalada en la pantalla de inicio.
 */
export default function NotificationSettings({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { showToast } = useToast()
  const [status, setStatus] = useState<Status>('loading')
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const check = async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        return 'unsupported' as const
      }
      if (!VAPID_PUBLIC_KEY) return 'unconfigured' as const
      if (Notification.permission === 'denied') return 'denied' as const
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()
      if (!subscription) return 'off' as const
      const res = await getPushPrefs(subscription.endpoint)
      if (cancelled) return null
      setEndpoint(subscription.endpoint)
      if (res.prefs) setPrefs(res.prefs)
      return res.prefs ? ('on' as const) : ('off' as const)
    }
    check().then((next) => {
      if (!cancelled && next) setStatus(next)
    })
    return () => {
      cancelled = true
    }
  }, [isOpen])

  const enable = async () => {
    if (!VAPID_PUBLIC_KEY) return
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off')
        return
      }
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) }))
      const res = await savePushSubscription(subscription.toJSON(), navigator.userAgent)
      if (res.error) {
        showToast(res.error, 'error')
        return
      }
      setEndpoint(subscription.endpoint)
      setPrefs(DEFAULT_PREFS)
      setStatus('on')
      showToast('Avisos activados en este dispositivo')
    } catch (error) {
      console.error(error)
      showToast('No se pudieron activar los avisos en este navegador.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await deletePushSubscription(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setEndpoint(null)
      setStatus('off')
      showToast('Avisos desactivados en este dispositivo')
    } finally {
      setBusy(false)
    }
  }

  const togglePref = async (key: keyof NotificationPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    if (endpoint) {
      const res = await updatePushPrefs(endpoint, next)
      if (res.error) showToast(res.error, 'error')
    }
  }

  const test = async () => {
    if (!endpoint) return
    setBusy(true)
    const res = await sendTestNotification(endpoint)
    setBusy(false)
    showToast(res.error ?? 'Aviso enviado: tendría que llegar en unos segundos.', res.error ? 'error' : 'success')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Notificaciones" description="Un resumen cada mañana, a las 8." size="sm">
      {status === 'loading' ? (
        <p className="flex items-center gap-2 py-4 text-sm text-fg-muted"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Revisando…</p>
      ) : status === 'unsupported' ? (
        <p className="text-sm text-fg-muted">Este navegador no admite notificaciones. En iPhone, primero agregá la app a la pantalla de inicio (Compartir → Agregar a inicio) y abrila desde ahí.</p>
      ) : status === 'unconfigured' ? (
        <p className="text-sm text-fg-muted">Las notificaciones todavía no están configuradas en el servidor.</p>
      ) : status === 'denied' ? (
        <p className="text-sm text-fg-muted">El navegador tiene bloqueadas las notificaciones de esta app. Habilitalas en la configuración del sitio y volvé a intentar.</p>
      ) : status === 'off' ? (
        <div className="space-y-3">
          <p className="text-sm text-fg-muted">Activalas para recibir cada mañana las tareas del día, las atrasadas, el VPD fuera de rango y el stock bajo.</p>
          <button type="button" className="btn btn-primary" onClick={enable} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Bell size={16} aria-hidden="true" />}
            Activar en este dispositivo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="field-label mb-1">Qué avisar</legend>
            {(Object.keys(PREF_LABELS) as (keyof NotificationPrefs)[]).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm text-fg">
                <input type="checkbox" className="h-4 w-4 accent-[color:var(--brand)]" checked={prefs[key]} onChange={() => togglePref(key)} />
                {PREF_LABELS[key]}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm btn-secondary" onClick={test} disabled={busy}>
              <Send size={15} aria-hidden="true" /> Mandar uno ahora
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={disable} disabled={busy}>
              <BellOff size={15} aria-hidden="true" /> Desactivar
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
