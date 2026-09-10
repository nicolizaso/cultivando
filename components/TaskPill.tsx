'use client'

import { useRef } from 'react'
import { Check, Trash2, RotateCcw, CheckCircle2, Circle, Pencil, Leaf } from 'lucide-react'
import { Task } from '@/app/lib/types'
import { getTaskType } from '@/app/lib/constants'

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
 * Fila de tarea.
 *
 * El acento del tipo tiñe sólo el icono y su cuadro: el texto se queda sobre la
 * superficie normal, que es la única forma de garantizar contraste AA en los
 * dos temas. El color y el icono salen de la taxonomía compartida, no de una
 * tabla propia como antes.
 */
export default function TaskPill({ task, onComplete, onDelete, onEdit, onClick, readOnly, selectionMode, isSelected, onSelect, onLongPress }: TaskPillProps) {
  const taskType = getTaskType(task.type || 'otro')
  const Icon = taskType.icon
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

      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${taskType.bg} ${taskType.color}`}
        aria-hidden="true"
      >
        <Icon size={16} />
      </span>

      <span className="flex min-w-0 flex-col text-left">
        {/* Completada se marca con tachado y color apagado, no bajando la
            opacidad de toda la fila: eso hundía el contraste del texto. */}
        <span className={`truncate text-sm font-semibold ${isCompleted && !selectionMode ? 'text-fg-muted line-through decoration-2' : 'text-fg'}`}>
          {task.title}
        </span>
        {task.description && (
          <span className="mt-0.5 truncate text-xs text-fg-muted">{task.description}</span>
        )}
        <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-fg-subtle">
          <time className="mono" dateTime={new Date(task.due_date).toISOString()}>
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
      className={`flex w-full items-center gap-2 rounded-[var(--radius-md)] border bg-surface-2 pr-2 transition-colors ${
        isSelected ? 'border-[color:var(--brand)] bg-brand-soft' : 'border-line hover:border-line-strong'
      }`}
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
        <div className="flex shrink-0 items-center gap-0.5">
          {onComplete && (
            <button
              type="button"
              onClick={() => onComplete(task.id)}
              className={`btn-icon btn-icon-sm ${
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
              className="btn-icon btn-icon-sm"
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
              className="btn-icon btn-icon-sm text-[color:var(--danger)]"
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
