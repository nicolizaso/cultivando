'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

export type ToastType = 'success' | 'error'

interface ToastProps {
  message: string
  type: ToastType
  isVisible: boolean
  onClose: () => void
}

export default function Toast({ message, type, isVisible, onClose }: ToastProps) {
  const [show, setShow] = useState(false)

  const handleClose = useCallback(() => {
    setShow(false)
    // Deja terminar la transición de salida antes de desmontar.
    setTimeout(onClose, 220)
  }, [onClose])

  useEffect(() => {
    if (!isVisible) {
      setShow(false)
      return
    }

    setShow(true)
    const timer = setTimeout(handleClose, 5000)
    return () => clearTimeout(timer)
  }, [isVisible, handleClose])

  if (!isVisible && !show) return null

  const isSuccess = type === 'success'

  return (
    // El contenedor es un live region: los errores interrumpen, los éxitos no.
    <div
      role={isSuccess ? 'status' : 'alert'}
      aria-live={isSuccess ? 'polite' : 'assertive'}
      className={`fixed inset-x-4 top-4 z-[150] mx-auto w-auto max-w-sm transition-[opacity,transform] duration-200 ease-out sm:inset-x-0 ${
        show ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
      }`}
    >
      <div
        className="flex items-start gap-3 rounded-[var(--radius-lg)] border bg-surface p-4 shadow-[var(--shadow-lg)]"
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
          <p className="mt-0.5 text-sm leading-snug text-fg-muted">{message}</p>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="btn-icon btn-icon-sm -mr-1 -mt-1 shrink-0"
          aria-label="Cerrar notificación"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
