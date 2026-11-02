'use client'

import type { ReactNode } from 'react'
import { CalendarDays } from 'lucide-react'
import { addDaysToKey, daysBetweenKeys, formatInAppTz, todayKey } from '@/app/lib/dates'
import { Field } from './Field'
import { Input } from './Input'

export interface QuickDate {
  label: string
  value: string
}

type QuickPreset = 'past' | 'future' | 'none'

interface DateFieldProps {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  /** Atajos debajo del campo: los más usados hacia atrás, hacia adelante o propios. */
  quick?: QuickPreset | QuickDate[]
  /** Ayuda extra; el día elegido en palabras se muestra siempre. */
  hint?: ReactNode
  error?: string | null
  optional?: boolean
  id?: string
  min?: string
  max?: string
  required?: boolean
  className?: string
}

function presetDates(preset: QuickPreset): QuickDate[] {
  const today = todayKey()
  if (preset === 'past') {
    return [
      { label: 'Hoy', value: today },
      { label: 'Ayer', value: addDaysToKey(today, -1) },
      { label: 'Anteayer', value: addDaysToKey(today, -2) },
    ]
  }
  if (preset === 'future') {
    return [
      { label: 'Hoy', value: today },
      { label: 'Mañana', value: addDaysToKey(today, 1) },
      { label: 'En una semana', value: addDaysToKey(today, 7) },
    ]
  }
  return []
}

/** "Hoy", "Ayer", "Hace 5 días", "En 2 semanas": la distancia a hoy, en palabras. */
export function relativeDay(key: string): string {
  const diff = daysBetweenKeys(todayKey(), key)
  if (diff === 0) return 'Hoy'
  if (diff === -1) return 'Ayer'
  if (diff === 1) return 'Mañana'
  if (diff === -2) return 'Anteayer'
  if (diff === 2) return 'Pasado mañana'
  const abs = Math.abs(diff)
  const amount = abs >= 14 && abs % 7 === 0 ? `${abs / 7} semanas` : `${abs} días`
  return diff < 0 ? `Hace ${amount}` : `En ${amount}`
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Fecha con atajos. Casi todo lo que se registra pasó hoy o ayer: eso queda a
 * un toque, y el selector nativo sigue ahí para cualquier otro día. Debajo se
 * dice en palabras qué día quedó elegido, con el día de la semana, que es
 * como se piensa el cultivo ("el riego del jueves").
 */
export function DateField({
  label, value, onChange, quick = 'past', hint, error, optional, id, min, max, required, className,
}: DateFieldProps) {
  const options = Array.isArray(quick) ? quick : presetDates(quick)

  const spoken = DATE_ONLY.test(value)
    ? `${relativeDay(value)}: ${formatInAppTz(value, { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '')}.`
    : null

  return (
    <Field
      label={label}
      id={id}
      error={error}
      optional={optional}
      className={className}
      hint={spoken || hint ? <>{spoken}{spoken && hint ? ' ' : ''}{hint}</> : undefined}
      below={
        options.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Atajos de fecha">
            {options.map((option) => (
              <button
                key={option.label}
                type="button"
                className="choice choice-sm"
                aria-pressed={value === option.value}
                onClick={() => onChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      <Input
        type="date"
        leading={<CalendarDays size={18} />}
        value={value}
        min={min}
        max={max}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}
