'use client'

import { useId } from 'react'
import type { ReactNode } from 'react'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  icon?: ReactNode
  disabled?: boolean
  className?: string
}

/**
 * Interruptor: una casilla real con piel de interruptor. Toda la fila es
 * tocable, no sólo la pastilla.
 */
export function Switch({ checked, onChange, label, description, icon, disabled, className = '' }: SwitchProps) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className={`relative flex min-h-[3rem] cursor-pointer items-center gap-3 ${disabled ? 'cursor-not-allowed opacity-60' : ''} ${className}`}
    >
      {icon && (
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[color:var(--brand-text)]"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-[0.8125rem] leading-snug text-fg-muted">{description}</span>}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="switch-track" aria-hidden="true" />
    </label>
  )
}
