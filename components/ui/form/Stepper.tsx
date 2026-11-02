'use client'

import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'

interface StepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** Unidad o sustantivo junto al número ("días", "plantas"). */
  suffix?: string
  id?: string
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  /** Nombre de lo que se cuenta, para los botones ("esqueje" → "Un esqueje menos"). */
  unitName?: string
  className?: string
}

/**
 * Número entero con − y +: se ajusta con el pulgar sin abrir el teclado, y
 * igual se puede escribir. Mientras se escribe se deja el campo vacío; al
 * salir se corrige al rango.
 */
export function Stepper({
  value, onChange, min = 0, max = 999, step = 1, suffix, id, unitName,
  className = '', ...aria
}: StepperProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const clamp = (n: number) => Math.min(max, Math.max(min, n))

  const commit = (raw: string) => {
    const parsed = Math.round(Number(raw.replace(',', '.')))
    onChange(Number.isFinite(parsed) && raw.trim() !== '' ? clamp(parsed) : clamp(value))
    setDraft(null)
  }

  const label = aria['aria-label']
  const less = unitName ? `Uno menos (${unitName})` : label ? `Menos: ${label}` : 'Menos'
  const more = unitName ? `Uno más (${unitName})` : label ? `Más: ${label}` : 'Más'

  return (
    <div className={`stepper ${className}`} data-invalid={aria['aria-invalid'] ? 'true' : undefined}>
      <button
        type="button"
        className="stepper-btn"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label={less}
      >
        <Minus size={18} strokeWidth={2.5} aria-hidden="true" />
      </button>
      <span className="stepper-value">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          className="stepper-input"
          value={draft ?? String(value)}
          onChange={(e) => {
            const raw = e.target.value
            setDraft(raw)
            const parsed = Number(raw)
            if (raw.trim() !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(Math.round(parsed))
          }}
          onBlur={(e) => commit(e.target.value)}
          onFocus={(e) => e.target.select()}
          style={{ width: `${Math.max(2, String(draft ?? value).length + 0.5)}ch` }}
          {...aria}
        />
        {suffix && <span className="stepper-suffix" aria-hidden="true">{suffix}</span>}
      </span>
      <button
        type="button"
        className="stepper-btn"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        aria-label={more}
      >
        <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  )
}
