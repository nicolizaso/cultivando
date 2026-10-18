'use client'

import React, { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react'
import Toast from '@/components/Toast'
import type { ToastAction, ToastState, ToastType } from '@/components/Toast'

interface ToastOptions {
  /** Un botón en el aviso, por ejemplo "Deshacer". */
  action?: ToastAction
  /** Milisegundos en pantalla. Con botón, más tiempo para alcanzar a tocarlo. */
  duration?: number
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const nextId = useRef(1)

  const showToast = useCallback((message: string, type: ToastType = 'success', options: ToastOptions = {}) => {
    setToast({
      id: nextId.current++,
      message,
      type,
      action: options.action,
      duration: options.duration ?? (options.action ? 8000 : 5000),
    })
  }, [])

  const closeToast = useCallback(() => setToast(null), [])
  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* El aviso vive acá, flotando sobre toda la app. */}
      <Toast toast={toast} onClose={closeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast debe usarse dentro de un ToastProvider')
  }
  return context
}
