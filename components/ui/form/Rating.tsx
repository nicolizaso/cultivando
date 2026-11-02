'use client'

import { useId } from 'react'
import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import { FieldGroup } from './Field'

interface RatingProps {
  legend: ReactNode
  /** 0 = sin calificar */
  value: number
  onChange: (value: number) => void
  max?: number
  optional?: boolean
  hint?: ReactNode
}

const WORDS = ['', 'Floja', 'Regular', 'Buena', 'Muy buena', 'Excelente']

/**
 * Estrellas como radios reales: se tocan, se recorren con flechas y se leen
 * como "3 de 5". Tocar la estrella elegida la quita.
 */
export function Rating({ legend, value, onChange, max = 5, optional, hint }: RatingProps) {
  const name = useId()
  return (
    <FieldGroup legend={legend} optional={optional} hint={hint}>
      <div className="flex items-center gap-3">
        <div className="flex">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
            const filled = n <= value
            return (
              <label
                key={n}
                className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-transform active:scale-90 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[color:var(--ring)]"
              >
                <input
                  type="radio"
                  name={name}
                  value={n}
                  checked={value === n}
                  onChange={() => onChange(n)}
                  onClick={() => { if (value === n) onChange(0) }}
                  className="sr-only"
                  aria-label={`${n} de ${max}${WORDS[n] ? `: ${WORDS[n]}` : ''}`}
                />
                <Star
                  size={28}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className={
                    filled
                      ? 'fill-[color:var(--accent-amber)] text-[color:var(--accent-amber)]'
                      : 'text-[color:var(--border-strong)]'
                  }
                />
              </label>
            )
          })}
        </div>
        <span className="text-sm font-semibold text-fg-muted" aria-hidden="true">
          {value > 0 ? WORDS[value] ?? `${value} de ${max}` : 'Sin calificar'}
        </span>
      </div>
    </FieldGroup>
  )
}
