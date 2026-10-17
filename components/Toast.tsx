'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react'

export type ToastType = 'success' | 'error'

/** Un botón dentro del aviso, por ejemplo "Deshacer". */
export interface ToastAction {
  label: string
  onClick: () => void | Promise<void>
}

export interface ToastState {
  /** Cambia con cada aviso: un mismo texto dos veces reinicia el temporizador. */
  id: number
  message: string
  type: ToastType
  action?: ToastAction
  duration: number
}

interface ToastProps {
  toast: ToastState | null
  onClose: () => void
}

export default function Toast({ toast, onClose }: ToastProps) {
  const reduceMotion = useReducedMotion()
  const [runningAction, setRunningAction] = useState<number | null>(null)

  // Se cierra solo. El temporizador se arma por aviso (`id`), así que un aviso
  // nuevo mientras se ve otro arranca su propia cuenta.
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onClose, toast.duration)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  const runAction = async () => {
    if (!toast?.action || runningAction === toast.id) return
    setRunningAction(toast.id)
    try {
      await toast.action.onClick()
    } finally {
      setRunningAction(null)
    }
    onClose()
  }

  const isSuccess = toast?.type !== 'error'

  return (
    // El contenedor es un live region: los errores interrumpen, los éxitos no.
    <div
      role={isSuccess ? 'status' : 'alert'}
      aria-live={isSuccess ? 'polite' : 'assertive'}
      className="pointer-events-none fixed inset-x-4 top-4 z-[150] mx-auto w-auto max-w-sm sm:inset-x-0"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="pointer-events-auto flex items-start gap-3 rounded-[var(--radius-lg)] border bg-surface p-4 shadow-[var(--shadow-lg)]"
            style={{
              borderColor: isSuccess
                ? 'color-mix(in srgb, var(--success) 35%, transparent)'
                : 'color-mix(in srgb, var(--danger) 35%, transparent)',
            }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: isSuccess ? 'var(--success-soft)' : 'var(--danger-soft)',
                color: isSuccess ? 'var(--success)' : 'var(--danger)',
              }}
              aria-hidden="true"
            >
              {isSuccess ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-semibold text-fg">
                {isSuccess ? 'Listo' : 'Algo salió mal'}
              </p>
              <p className="mt-0.5 text-sm leading-snug text-fg-muted">{toast.message}</p>
              {toast.action && (
                <button
                  type="button"
                  onClick={runAction}
                  disabled={runningAction === toast.id}
                  className="btn btn-ghost btn-sm -ml-2 mt-1"
                >
                  {runningAction === toast.id && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                  {toast.action.label}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-icon btn-icon-sm -mr-1 -mt-1 shrink-0"
              aria-label="Cerrar notificación"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
