'use client'

import { useRef } from 'react'
import { Check, Trash2, Droplets, FlaskConical, ShieldAlert, Shovel, Scissors, Activity, ArrowRightLeft, CloudRain, Flower, Skull, FileText, RotateCcw, CheckCircle2, Circle, Pencil, ArrowRightCircle } from 'lucide-react'
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

// Helper para obtener icono y colores según el tipo
const getTaskStyle = (type: string) => {
  switch (type.toLowerCase()) {
    case 'riego': return { color: 'bg-[#00a599]/20 text-[#00a599] border-[#00a599]/30', icon: Droplets }
    case 'fertilizante': return { color: 'bg-green-500/20 text-green-300 border-green-500/30', icon: FlaskConical }
    case 'repelente': return { color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icon: ShieldAlert }
    case 'trasplante': return { color: 'bg-amber-700/20 text-amber-300 border-amber-700/30', icon: Shovel }
    case 'poda': return { color: 'bg-slate-500/20 text-foreground border-slate-500/30', icon: Scissors }
    case 'entrenamiento': return { color: 'bg-slate-500/20 text-foreground border-slate-500/30', icon: Activity }
    case 'ambiente': return { color: 'bg-slate-500/20 text-foreground border-slate-500/30', icon: ArrowRightLeft }
    case 'cambio_etapa': return { color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: ArrowRightCircle }
    case 'lavado': return { color: 'bg-slate-600/20 text-foreground border-slate-600/30', icon: CloudRain }
    case 'cosechar': return { color: 'bg-violet-500/20 text-violet-300 border-violet-500/30', icon: Flower }
    case 'muerta': return { color: 'bg-red-900/40 text-red-200 border-red-500/30', icon: Skull }
    default: return { color: 'bg-slate-700/40 text-foreground border-slate-600/30', icon: FileText }
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

  const handleClick = (e: React.MouseEvent) => {
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

  return (
    <div 
      className={`w-full flex items-center justify-between p-3 rounded-xl border mb-2 cursor-pointer transition-all hover:brightness-110 select-none
        ${style.color}
        ${isCompleted && !selectionMode ? 'opacity-50' : ''}
        ${isSelected ? 'ring-2 ring-white/50 bg-card-border' : ''}
      `}
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onClick={handleClick}
      onContextMenu={(e) => {
        if (!readOnly) e.preventDefault()
      }}
    >
      <div className="flex items-center gap-3 overflow-hidden pointer-events-none">
        {selectionMode && (
          <div className="shrink-0 transition-all duration-300">
             {isSelected ? <CheckCircle2 size={20} className="text-foreground drop-shadow-md" /> : <Circle size={20} className="text-foreground/30" />}
          </div>
        )}

        <div className={`p-1.5 rounded-lg bg-black/20 shrink-0`}>
          <Icon size={16} />
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className={`text-sm font-bold truncate ${isCompleted && !selectionMode ? 'line-through decoration-2 decoration-current/50' : ''}`}>{task.title}</span>
          {task.description && (
            <span className={`text-xs text-muted mt-0.5 truncate ${isCompleted && !selectionMode ? 'line-through decoration-current/50' : ''}`}>
              {task.description}
            </span>
          )}
          <span className="text-[10px] opacity-70 truncate">
            {new Date(task.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
            {(() => {
               if (task.task_plants && task.task_plants.length > 0) {
                  const count = task.task_plants.length;
                  const first = task.task_plants[0].plants?.name;
                  if (count > 1) return ` • 🌿 ${first} +${count - 1}`;
                  if (first) return ` • 🌿 ${first}`;
               }
               return task.cycleNames ? ` • ${task.cycleNames}` : (task.cycleName ? ` • ${task.cycleName}` : '');
            })()}
          </span>
        </div>
      </div>

      {!readOnly && !selectionMode && (
        <div className="flex gap-2 ml-2">
          {onComplete && (
            <button 
              onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}
              className={`p-1.5 rounded-lg transition-colors ${isCompleted ? 'bg-amber-500/20 hover:bg-amber-500/40 text-amber-400' : 'bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400'}`}
              title={isCompleted ? "Marcar como pendiente" : "Marcar como completada"}
            >
              {isCompleted ? <RotateCcw size={14} /> : <Check size={14} />}
            </button>
          )}
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(task); }}
              className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 transition-colors"
              title="Editar"
            >
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
