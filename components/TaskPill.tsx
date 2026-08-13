'use client'

import { useRef } from 'react'
import { Check, Trash2, Droplets, FlaskConical, ShieldAlert, Shovel, Scissors, Activity, ArrowRightLeft, CloudRain, Flower, Skull, FileText, RotateCcw, CheckCircle2, Circle, Pencil, ArrowRightCircle, Leaf } from 'lucide-react'
import { Task } from '@/app/lib/types'

interface TaskPillProps {
  task: Task
  onComplete?: (id: string | number) => void
  onDelete?: (id: string | number) => void
  onEdit?: (task: Task) => void
  onClick?: (task: Task) => void
  readOnly?: boolean
  selectionMode?: boolean
  isSelected?: boolean
  onSelect?: (id: string | number) => void
  onLongPress?: (id: string | number) => void
}

/**
 * Acento por tipo de tarea. Sólo tiñe el icono y el borde: el texto se queda
 * sobre la superficie normal, que es la única forma de garantizar contraste
 * AA en los dos temas.
 */
const getTaskStyle = (type: string) => {
  switch (type.toLowerCase()) {
    case 'riego': return { accent: 'text-sky-700 dark:text-sky-300', tint: 'bg-sky-500/10', icon: Droplets }
    case 'fertilizante': return { accent: 'text-emerald-700 dark:text-emerald-300', tint: 'bg-emerald-500/10', icon: FlaskConical }
    case 'repelente': return { accent: 'text-orange-700 dark:text-orange-300', tint: 'bg-orange-500/10', icon: ShieldAlert }
    case 'trasplante': return { accent: 'text-amber-700 dark:text-amber-300', tint: 'bg-amber-600/10', icon: Shovel }
    case 'poda': return { accent: 'text-slate-700 dark:text-slate-300', tint: 'bg-slate-500/10', icon: Scissors }
    case 'entrenamiento': return { accent: 'text-teal-700 dark:text-teal-300', tint: 'bg-teal-500/10', icon: Activity }
    case 'ambiente': return { accent: 'text-indigo-700 dark:text-indigo-300', tint: 'bg-indigo-500/10', icon: ArrowRightLeft }
    case 'cambio_etapa': return { accent: 'text-purple-700 dark:text-purple-300', tint: 'bg-purple-500/10', icon: ArrowRightCircle }
    case 'lavado': return { accent: 'text-cyan-700 dark:text-cyan-300', tint: 'bg-cyan-500/10', icon: CloudRain }
    case 'cosechar': return { accent: 'text-violet-700 dark:text-violet-300', tint: 'bg-violet-500/10', icon: Flower }
    case 'muerta': return { accent: 'text-rose-700 dark:text-rose-300', tint: 'bg-rose-500/10', icon: Skull }
    default: return { accent: 'text-stone-700 dark:text-stone-300', tint: 'bg-stone-500/10', icon: FileText }
  }
}

export default function TaskPill({ task, onComplete, onDelete, onEdit, onClick, readOnly, selectionMode, isSelected, onSelect, onLongPress }: TaskPillProps) {
  const style = getTaskStyle(task.type || 'otro')
  const Icon = style.icon
  const isCompleted = task.status === 'completed'

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isLongPressTriggered = useRef(false)

  const handleStart = () => {
    if (readOnly || selectionMode) return
    isLongPressTriggered.current = false
    timerRef.current = setTimeout(() => {
      isLongPressTriggered.current = true
      if (onLongPress) onLongPress(task.id)
    }, 600)
  }

  const handleEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handleActivate = () => {
    if (isLongPressTriggered.current) {
      isLongPressTriggered.current = false
      return
    }

    if (selectionMode && onSelect) {
      onSelect(task.id)
    } else if (onClick) {
      onClick(task)
    } else if (onComplete && !readOnly && !selectionMode) {
      onComplete(task.id)
    }
  }

  const targetLabel = (() => {
    if (task.task_plants && task.task_plants.length > 0) {
      const count = task.task_plants.length
      const first = task.task_plants[0].plants?.name
      if (count > 1) return `${first} +${count - 1}`
      if (first) return first
    }
    return task.cycleNames || task.cycleName || ''
  })()

  const interactive = !readOnly

  const body = (
    <>
      {selectionMode && (
        <span className="shrink-0" aria-hidden="true">
          {isSelected
            ? <CheckCircle2 size={20} className="text-[color:var(--brand-text)]" />
            : <Circle size={20} className="text-fg-subtle" />}
        </span>
      )}

      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${style.tint} ${style.accent}`} aria-hidden="true">
        <Icon size={16} />
      </span>

      <span className="flex min-w-0 flex-col text-left">
        <span className={`truncate text-sm font-semibold text-fg ${isCompleted && !selectionMode ? 'line-through decoration-2' : ''}`}>
          {task.title}
        </span>
        {task.description && (
          <span className="mt-0.5 truncate text-xs text-fg-muted">{task.description}</span>
        )}
        <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-fg-subtle">
          <time dateTime={new Date(task.due_date).toISOString()}>
            {new Date(task.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
          </time>
          {targetLabel && (
            <>
              <Leaf size={11} aria-hidden="true" />
              <span className="truncate">{targetLabel}</span>
            </>
          )}
        </span>
      </span>
    </>
  )

  return (
    <div
      className={`mb-2 flex w-full items-center gap-2 rounded-[var(--radius-md)] border bg-surface-2 pr-2 transition-colors ${
        isSelected ? 'border-[color:var(--brand)] bg-brand-soft' : 'border-line hover:border-line-strong'
      } ${isCompleted && !selectionMode ? 'opacity-70' : ''}`}
    >
      {/* El área principal es un botón real: antes era un div con onClick,
          inalcanzable con teclado. La pulsación larga sigue disponible. */}
      {interactive ? (
        <button
          type="button"
          onMouseDown={handleStart}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchEnd={handleEnd}
          onClick={handleActivate}
          onContextMenu={(e) => e.preventDefault()}
          aria-pressed={selectionMode ? isSelected : isCompleted}
          aria-label={
            selectionMode
              ? `Seleccionar ${task.title}`
              : isCompleted
                ? `Marcar ${task.title} como pendiente`
                : `Marcar ${task.title} como completada`
          }
          className="flex min-w-0 flex-1 select-none items-center gap-3 p-3 text-left"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 p-3">{body}</div>
      )}

      {!readOnly && !selectionMode && (
        <div className="flex shrink-0 items-center gap-1">
          {onComplete && (
            <button
              type="button"
              onClick={() => onComplete(task.id)}
              className={`btn-icon h-9 min-h-9 w-9 min-w-9 ${
                isCompleted ? 'text-[color:var(--warning)]' : 'text-[color:var(--success)]'
              }`}
              aria-label={isCompleted ? `Reabrir ${task.title}` : `Completar ${task.title}`}
              title={isCompleted ? "Marcar como pendiente" : "Marcar como completada"}
            >
              {isCompleted ? <RotateCcw size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="btn-icon h-9 min-h-9 w-9 min-w-9"
              aria-label={`Editar ${task.title}`}
              title="Editar"
            >
              <Pencil size={16} aria-hidden="true" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              className="btn-icon h-9 min-h-9 w-9 min-w-9 text-[color:var(--danger)]"
              aria-label={`Eliminar ${task.title}`}
              title="Eliminar"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
