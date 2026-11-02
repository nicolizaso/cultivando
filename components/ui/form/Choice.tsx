'use client'

import { useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Field, FieldGroup } from './Field'
import { Select } from './Input'

export interface ChoiceOption<T extends string | number> {
  value: T
  label: ReactNode
  /** Icono ya dibujado (decorativo). */
  icon?: ReactNode
  /** Color de la opción: una variable CSS (`var(--accent-cyan)`). */
  accent?: string
  /** Una línea de contexto, sólo en la variante tarjeta. */
  description?: ReactNode
  disabled?: boolean
}

type Variant = 'chip' | 'tile' | 'compact' | 'segment'

interface BaseProps<T extends string | number> {
  legend: ReactNode
  options: ChoiceOption<T>[]
  hint?: ReactNode
  error?: string | null
  optional?: boolean
  hideLegend?: boolean
  aside?: ReactNode
  variant?: Variant
  size?: 'sm' | 'md'
  /** Clases del contenedor de opciones (p. ej. la grilla de las tarjetas). */
  layout?: string
  className?: string
  name?: string
}

/**
 * Acento de taxonomía → variables del chip. El tinte tenue de cada acento se
 * llama igual con `-soft` al final (`--accent-cyan` / `--accent-cyan-soft`).
 */
export function accentStyle(accent?: string): CSSProperties | undefined {
  if (!accent) return undefined
  const soft = accent.replace(/\)\s*$/, '-soft)')
  return { '--choice': accent, '--choice-soft': soft, '--choice-text': accent } as CSSProperties
}

const VARIANT_CLASS: Record<Variant, string> = {
  chip: 'choice',
  tile: 'choice choice-tile',
  compact: 'choice choice-tile choice-tile-compact',
  segment: 'segmented-item',
}

const DEFAULT_LAYOUT: Record<Variant, string> = {
  chip: 'flex flex-wrap gap-2',
  tile: 'grid grid-cols-1 gap-2 sm:grid-cols-2',
  compact: 'grid grid-cols-3 gap-2 sm:grid-cols-4',
  segment: 'segmented segmented-block',
}

function OptionBody<T extends string | number>({ option, variant }: { option: ChoiceOption<T>; variant: Variant }) {
  if (variant === 'segment') {
    return (
      <>
        {option.icon && <span className="inline-flex" aria-hidden="true">{option.icon}</span>}
        {option.label}
      </>
    )
  }

  if (variant === 'tile') {
    return (
      <>
        {option.icon && <span className="choice-icon" aria-hidden="true">{option.icon}</span>}
        <span className="pr-5">{option.label}</span>
        {option.description && <span className="choice-tile-desc">{option.description}</span>}
        <Check size={16} strokeWidth={2.75} className="choice-check" aria-hidden="true" />
      </>
    )
  }

  if (variant === 'compact') {
    return (
      <>
        {option.icon && <span className="choice-icon" aria-hidden="true">{option.icon}</span>}
        <span className="leading-tight">{option.label}</span>
      </>
    )
  }

  return (
    <>
      {option.icon ? (
        <span className="choice-icon" aria-hidden="true">{option.icon}</span>
      ) : (
        <Check size={15} strokeWidth={2.75} className="choice-check -ml-1" aria-hidden="true" />
      )}
      {option.label}
      {option.icon && <Check size={14} strokeWidth={2.75} className="choice-check -mr-1" aria-hidden="true" />}
    </>
  )
}

interface ChoiceGroupProps<T extends string | number> extends BaseProps<T> {
  value: T | null | undefined
  onChange: (value: T) => void
}

/**
 * Elegir una opción entre pocas, todas a la vista. Son radios reales: se
 * recorren con las flechas y se anuncian como grupo.
 */
export function ChoiceGroup<T extends string | number>({
  legend, options, value, onChange, hint, error, optional, hideLegend, aside,
  variant = 'chip', size = 'md', layout, className, name,
}: ChoiceGroupProps<T>) {
  const generated = useId()
  const groupName = name ?? generated

  return (
    <FieldGroup legend={legend} hint={hint} error={error} optional={optional} hideLegend={hideLegend} aside={aside} className={className}>
      <div className={layout ?? DEFAULT_LAYOUT[variant]}>
        {options.map((option) => (
          <label
            key={String(option.value)}
            className={`${VARIANT_CLASS[variant]} ${size === 'sm' && variant === 'chip' ? 'choice-sm' : ''}`}
            style={accentStyle(option.accent)}
          >
            <input
              type="radio"
              name={groupName}
              value={String(option.value)}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <OptionBody option={option} variant={variant} />
          </label>
        ))}
      </div>
    </FieldGroup>
  )
}

interface MultiChoiceProps<T extends string | number> extends BaseProps<T> {
  values: T[]
  onToggle: (value: T) => void
}

/** Varias opciones a la vez: casillas reales con la misma piel. */
export function MultiChoice<T extends string | number>({
  legend, options, values, onToggle, hint, error, optional, hideLegend, aside,
  variant = 'chip', size = 'md', layout, className,
}: MultiChoiceProps<T>) {
  return (
    <FieldGroup legend={legend} hint={hint} error={error} optional={optional} hideLegend={hideLegend} aside={aside} className={className}>
      <div className={layout ?? DEFAULT_LAYOUT[variant]}>
        {options.map((option) => (
          <label
            key={String(option.value)}
            className={`${VARIANT_CLASS[variant]} ${size === 'sm' && variant === 'chip' ? 'choice-sm' : ''}`}
            style={accentStyle(option.accent)}
          >
            <input
              type="checkbox"
              value={String(option.value)}
              checked={values.includes(option.value)}
              disabled={option.disabled}
              onChange={() => onToggle(option.value)}
              className="sr-only"
            />
            <OptionBody option={option} variant={variant} />
          </label>
        ))}
      </div>
    </FieldGroup>
  )
}

interface ChoiceOrSelectProps<T extends string | number> extends ChoiceGroupProps<T> {
  /** Texto de la opción vacía del desplegable. */
  placeholder?: string
  /** Hasta cuántas opciones se muestran como chips; más, desplegable. */
  threshold?: number
}

/**
 * Para listas que dependen del usuario (sus ciclos, sus espacios): casi
 * siempre son pocas y van a la vista; si un día son muchas, pasan a un
 * desplegable sin que el formulario se vuelva una pared de chips.
 */
export function ChoiceOrSelect<T extends string | number>({
  placeholder = 'Elegir…', threshold = 6, ...props
}: ChoiceOrSelectProps<T>) {
  if (props.options.length <= threshold) return <ChoiceGroup {...props} />

  const { legend, options, value, onChange, hint, error, optional, className } = props
  return (
    <Field label={legend} hint={hint} error={error} optional={optional} className={className}>
      <Select
        value={value == null ? '' : String(value)}
        onChange={(e) => {
          const match = options.find((option) => String(option.value) === e.target.value)
          if (match) onChange(match.value)
        }}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
            {typeof option.label === 'string' ? option.label : String(option.value)}
          </option>
        ))}
      </Select>
    </Field>
  )
}
