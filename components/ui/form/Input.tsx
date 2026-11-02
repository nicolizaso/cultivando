'use client'

import type { InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Icono a la izquierda, decorativo. */
  leading?: ReactNode
  /** Unidad a la derecha (°C, ml, L): se lee como parte del valor. */
  suffix?: string
  /** Un botón dentro del campo, a la derecha (mostrar contraseña, limpiar). */
  action?: ReactNode
  ref?: Ref<HTMLInputElement>
}

/**
 * Campo de texto con prefijo, unidad o acción adentro. La unidad se calcula
 * en el relleno para que el número nunca quede debajo de ella.
 */
export function Input({ leading, suffix, action, className = '', style, ref, ...props }: InputProps) {
  if (!leading && !suffix && !action) {
    return <input ref={ref} className={`field-input ${className}`} style={style} {...props} />
  }

  const paddingRight = action ? '3.25rem' : suffix ? `${1.5 + suffix.length * 0.55}rem` : undefined

  return (
    <div className="relative">
      {leading && (
        <span className="input-affix input-affix-start" aria-hidden="true">
          {leading}
        </span>
      )}
      <input
        ref={ref}
        className={`field-input ${leading ? 'pl-11' : ''} ${className}`}
        style={{ paddingRight, ...style }}
        {...props}
      />
      {suffix && !action && (
        <span className="input-affix input-affix-end" aria-hidden="true">
          {suffix}
        </span>
      )}
      {action && <span className="input-affix-action">{action}</span>}
    </div>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>
}

/** Texto largo que crece con el contenido. */
export function Textarea({ className = '', rows = 3, ref, ...props }: TextareaProps) {
  return <textarea ref={ref} rows={rows} className={`field-input ${className}`} {...props} />
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  leading?: ReactNode
  ref?: Ref<HTMLSelectElement>
}

/** Desplegable nativo (lo mejor en móvil para listas largas) con su chevrón. */
export function Select({ leading, className = '', children, ref, ...props }: SelectProps) {
  return (
    <div className="relative">
      {leading && (
        <span className="input-affix input-affix-start" aria-hidden="true">
          {leading}
        </span>
      )}
      <select ref={ref} className={`field-input has-icon ${leading ? 'pl-11' : ''} ${className}`} {...props}>
        {children}
      </select>
      <span className="input-affix input-affix-end" aria-hidden="true">
        <ChevronDown size={18} />
      </span>
    </div>
  )
}
