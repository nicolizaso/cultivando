'use client'

import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertCircle, ChevronDown, Info, Loader2, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface FormSectionProps {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  aside?: ReactNode
  className?: string
  children: ReactNode
}

/** Un bloque del formulario con título. Separa con aire y una línea, sin tarjetas. */
export function FormSection({ title, description, icon, aside, className = '', children }: FormSectionProps) {
  const id = useId()
  return (
    <section aria-labelledby={id} className={`form-section space-y-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={id} className="form-section-title">
            {icon && <span className="text-[color:var(--brand-text)]" aria-hidden="true">{icon}</span>}
            {title}
          </h3>
          {description && <p className="mt-1 text-[0.8125rem] leading-snug text-fg-muted">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

interface DisclosureProps {
  label: ReactNode
  /** Lo que se ve cerrado: un resumen de lo que hay adentro. */
  summary?: ReactNode
  icon?: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  children: ReactNode
}

/**
 * Lo que se usa de vez en cuando queda plegado y no alarga el formulario. El
 * resumen dice qué hay adentro sin tener que abrirlo.
 */
export function Disclosure({ label, summary, icon, defaultOpen = false, open, onOpenChange, className = '', children }: DisclosureProps) {
  const [innerOpen, setInnerOpen] = useState(defaultOpen)
  const isOpen = open ?? innerOpen
  const id = useId()

  const toggle = () => {
    const next = !isOpen
    if (open === undefined) setInnerOpen(next)
    onOpenChange?.(next)
  }

  return (
    <div className={`rounded-[var(--radius-lg)] border border-line ${isOpen ? 'bg-surface' : 'bg-surface-2'} transition-colors ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={id}
        className="flex min-h-[3.25rem] w-full items-center gap-3 rounded-[var(--radius-lg)] px-4 py-2.5 text-left"
      >
        {icon && <span className="shrink-0 text-[color:var(--brand-text)]" aria-hidden="true">{icon}</span>}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-fg">{label}</span>
          {summary && !isOpen && <span className="block truncate text-[0.8125rem] text-fg-muted">{summary}</span>}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-fg-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {isOpen && (
        <div id={id} className="space-y-4 px-4 pb-4 pt-1 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  )
}

interface FormAlertProps {
  tone?: 'error' | 'warning' | 'info'
  className?: string
  children: ReactNode
}

const ALERT_TONE = {
  error: {
    icon: AlertCircle,
    cls: 'border-[color:color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]',
  },
  warning: {
    icon: TriangleAlert,
    cls: 'border-[color:color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]',
  },
  info: {
    icon: Info,
    cls: 'border-line bg-surface-2 text-fg-muted',
  },
} as const

/** Aviso dentro del formulario: errores del servidor o contexto importante. */
export function FormAlert({ tone = 'error', className = '', children }: FormAlertProps) {
  const { icon: Icon, cls } = ALERT_TONE[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-[var(--radius-md)] border p-3 text-sm font-medium leading-snug ${cls} ${className}`}
    >
      <Icon size={17} className="mt-px shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

interface FormActionsProps {
  /** id del <form>: el botón principal lo envía desde el pie del modal. */
  form?: string
  /** Sin `form`, el botón principal llama a esto. */
  onSubmit?: () => void
  submitLabel: ReactNode
  pendingLabel?: ReactNode
  pending?: boolean
  disabled?: boolean
  icon?: LucideIcon
  onCancel?: () => void
  cancelLabel?: string
  /** Texto de estado a la izquierda ("3 tareas"). */
  status?: ReactNode
  /** Acción secundaria a la izquierda (borrar). */
  extra?: ReactNode
  tone?: 'primary' | 'danger'
}

/**
 * Pie de los formularios. En el teléfono el botón principal ocupa todo el
 * ancho, al alcance del pulgar, y "Cancelar" se va: la X del encabezado y el
 * gesto de atrás ya cierran. En escritorio vuelve el par Cancelar/Guardar.
 */
export function FormActions({
  form, onSubmit, submitLabel, pendingLabel, pending, disabled, icon: Icon,
  onCancel, cancelLabel = 'Cancelar', status, extra, tone = 'primary',
}: FormActionsProps) {
  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      {status && (
        <span className="w-full text-sm text-fg-muted sm:mr-auto sm:w-auto" role="status">
          {status}
        </span>
      )}
      {extra && <span className={`flex items-center gap-2 ${status ? '' : 'sm:mr-auto'}`}>{extra}</span>}
      {onCancel && (
        <button
          type="button"
          className={`btn btn-ghost hidden sm:inline-flex ${!status && !extra ? 'sm:ml-auto' : ''}`}
          onClick={onCancel}
          disabled={pending}
        >
          {cancelLabel}
        </button>
      )}
      <button
        type={form ? 'submit' : 'button'}
        form={form}
        onClick={form ? undefined : onSubmit}
        className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'} min-h-[3rem] flex-1 sm:min-h-[2.75rem] sm:flex-none ${!onCancel && !status && !extra ? 'sm:ml-auto' : ''}`}
        disabled={pending || disabled}
        aria-busy={pending || undefined}
      >
        {pending ? (
          <Loader2 size={17} className="animate-spin" aria-hidden="true" />
        ) : (
          Icon && <Icon size={17} aria-hidden="true" />
        )}
        {pending ? pendingLabel ?? 'Guardando…' : submitLabel}
      </button>
    </div>
  )
}
