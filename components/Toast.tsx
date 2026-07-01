'use client'

import { useEffect, useState } from 'react'
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

  // Manejo de animación de entrada/salida
  useEffect(() => {
    if (isVisible) {
      setShow(true)
      // Auto-cerrar después de 4 segundos
      const timer = setTimeout(() => {
        handleClose()
      }, 4000)
      return () => clearTimeout(timer)
    } else {
      // Esperar a que termine la animación de salida para desmontar (opcional, aquí simple)
      setShow(false)
    }
  }, [isVisible])

  const handleClose = () => {
    setShow(false)
    setTimeout(onClose, 300) // Tiempo para la animación de salida
  }

  if (!isVisible && !show) return null

  const isSuccess = type === 'success'

  return (
    <div 
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-100 w-[90%] max-w-sm
        transition-all duration-300 ease-in-out transform
        ${show ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0'}
      `}
    >
      <div className={`
        relative flex items-center gap-3 p-4 rounded-2xl shadow-sm backdrop-blur-md border
        ${isSuccess 
          ? 'bg-card/90 border-brand-primary/30 shadow-[0_4px_20px_rgba(0,165,153,0.2)]'
          : 'bg-card/90 border-red-500/30 shadow-[0_4px_20px_rgba(239,68,68,0.2)]'
        }
      `}>
        {/* Icono */}
        <div className={`
          p-2 rounded-full shrink-0
          ${isSuccess ? 'bg-brand-primary/20 text-brand-primary' : 'bg-red-500/20 text-red-500'}
        `}>
          {isSuccess ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
        </div>

        {/* Texto */}
        <div className="flex-1">
          <p className={`text-sm font-bold ${isSuccess ? 'text-foreground' : 'text-red-100'}`}>
            {isSuccess ? '¡Éxito!' : 'Algo salió mal'}
          </p>
          <p className="text-xs text-muted mt-0.5 leading-snug">
            {message}
          </p>
        </div>

        {/* Botón Cerrar */}
        <button 
          onClick={handleClose}
          className="p-1 rounded-full text-muted hover:bg-card-border hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}