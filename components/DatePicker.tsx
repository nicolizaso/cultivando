'use client'

import { useId } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'

interface DatePickerProps {
  selectedDate: string // YYYY-MM-DD
  onChange: (date: string) => void
  id?: string
  'aria-label'?: string
}

/**
 * Selector de fecha basado en <input type="date">.
 *
 * La versión anterior era un calendario propio construido con divs: no recibía
 * foco, no respondía al teclado, se posicionaba escuchando el scroll de la
 * ventana y sus botones de día enviaban el formulario al estar dentro de uno.
 * El control nativo resuelve todo eso y en móvil abre el selector del sistema.
 */
export default function DatePicker({ selectedDate, onChange, id, 'aria-label': ariaLabel }: DatePickerProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className="relative">
      <CalendarIcon
        className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-fg-muted"
        aria-hidden="true"
      />
      <input
        id={inputId}
        type="date"
        value={selectedDate}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className="field-input pl-10"
      />
    </div>
  )
}
