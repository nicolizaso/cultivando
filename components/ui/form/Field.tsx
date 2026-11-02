'use client'

import { cloneElement, isValidElement, useId } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

interface FieldProps {
  label: ReactNode
  /** Si no se pasa, se genera uno y se le pone al control. */
  id?: string
  hint?: ReactNode
  error?: string | null
  /** Marca el campo como opcional, en palabras. */
  optional?: boolean
  /** Algo a la derecha de la etiqueta (un enlace, un contador). */
  aside?: ReactNode
  className?: string
  /** Algo entre el control y la ayuda (atajos, una vista previa). */
  below?: ReactNode
  /** Un único control: recibe id, aria-describedby y aria-invalid. */
  children: ReactElement
}

type ControlProps = { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }

/**
 * Etiqueta arriba, control, ayuda y error abajo. Conecta todo por id para que
 * el lector de pantalla lea la ayuda y el error junto con el campo.
 */
export function Field({ label, id, hint, error, optional, aside, below, className = '', children }: FieldProps) {
  const generated = useId()
  const controlId = id ?? generated
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  const control = isValidElement<ControlProps>(children)
    ? cloneElement(children, {
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children

  return (
    <div className={`field ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={controlId} className="field-label">
          {label}
          {optional && <span className="field-optional">opcional</span>}
        </label>
        {aside}
      </div>
      {control}
      {below}
      <FieldMessages hint={hint} hintId={hintId} error={error} errorId={errorId} />
    </div>
  )
}

interface FieldGroupProps {
  legend: ReactNode
  hint?: ReactNode
  error?: string | null
  optional?: boolean
  /** La leyenda sigue existiendo para el lector de pantalla, pero no se ve. */
  hideLegend?: boolean
  aside?: ReactNode
  className?: string
  children: ReactNode
}

/** Igual que Field, pero para un grupo de opciones: fieldset con leyenda. */
export function FieldGroup({ legend, hint, error, optional, hideLegend, aside, className = '', children }: FieldGroupProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <fieldset
      className={`field ${className}`}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      data-invalid={error ? 'true' : undefined}
    >
      {/* La leyenda no se deja maquetar con flex: el contenido va adentro. */}
      <legend className={hideLegend ? 'sr-only' : 'mb-2 w-full'}>
        <span className="flex items-baseline justify-between gap-3">
          <span className="field-label">
            {legend}
            {optional && <span className="field-optional">opcional</span>}
          </span>
          {aside}
        </span>
      </legend>
      {children}
      <FieldMessages hint={hint} hintId={hintId} error={error} errorId={errorId} />
    </fieldset>
  )
}

function FieldMessages({ hint, hintId, error, errorId }: { hint?: ReactNode; hintId: string; error?: string | null; errorId: string }) {
  return (
    <>
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          <AlertCircle size={15} className="mt-px shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </>
  )
}
