'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Trash2 } from 'lucide-react'
import { Task } from "@/app/lib/types"
import TaskPill from "./TaskPill"
import EditTaskModal from "./EditTaskModal"
import EsquejarModal from "./EsquejarModal"
import { toggleTaskStatus, deleteTasks } from "@/app/actions/tasks"
import type { AmbienteMoveResult, TaskCompletionEffects } from "@/app/actions/tasks"
import { useToast } from "@/app/context/ToastContext"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import SelectionBar from "@/components/ui/SelectionBar"

/** El aviso al completar una tarea, contando lo que cambió en las plantas. */
function completionMessage(effects?: TaskCompletionEffects | null): string {
  if (!effects || effects.count === 0) return '¡Tarea completada!'

  const plants = effects.count === 1 ? '1 planta' : `${effects.count} plantas`
  switch (effects.kind) {
    case 'stage':
      return `¡Tarea completada! ${plants} ${effects.count === 1 ? 'pasó' : 'pasaron'} a ${effects.stage}.`
    case 'archive':
      return `¡Tarea completada! ${plants} ${effects.count === 1 ? 'se archivó' : 'se archivaron'}.`
    default:
      return '¡Tarea completada!'
  }
}

/** El aviso al completar un cambio de ambiente: qué se mudó y qué quedó. */
function ambienteMessage(ambiente: AmbienteMoveResult): string {
  const parts: string[] = []
  if (ambiente.cycles > 0) {
    parts.push(ambiente.cycles === 1 ? '1 ciclo' : `${ambiente.cycles} ciclos`)
  }
  if (ambiente.plants > 0) {
    parts.push(ambiente.plants === 1 ? '1 planta' : `${ambiente.plants} plantas`)
  }

  let message = '¡Tarea completada!'
  if (parts.length > 0) {
    const moved = ambiente.cycles + ambiente.plants
    message += ` ${parts.join(' y ')} ${moved === 1 ? 'pasó' : 'pasaron'} a ${ambiente.spaceName}.`
  }
  if (ambiente.unplaced > 0) {
    const plants = ambiente.unplaced === 1 ? '1 planta no se movió' : `${ambiente.unplaced} plantas no se movieron`
    message += ` ${plants}: ${ambiente.spaceName} no tiene un único ciclo activo. Movela${ambiente.unplaced === 1 ? '' : 's'} de ciclo a mano.`
  }
  return message
}

interface AgendaListProps {
  tasks: Task[]
  disableDateFilter?: boolean
  groupByStatus?: boolean
}

export default function AgendaList({ tasks, disableDateFilter = false, groupByStatus = false }: AgendaListProps) {
  const { showToast } = useToast()

  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedTasks, setSelectedTasks] = useState<Set<string | number>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [esquejandoTask, setEsquejandoTask] = useState<Task | null>(null)

  // Filter tasks for today using local time
  const todayStr = new Date().toLocaleDateString('en-CA');
  const tasksToDisplay = disableDateFilter
    ? tasks
    : tasks.filter(t => t.due_date && t.due_date.split('T')[0] === todayStr);

  const handleToggle = async (id: string | number) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return

    const newStatus = task.status === 'completed' ? 'pending' : 'completed'

    // El esquejado no se completa de un toque: primero hay que decir de qué
    // plantas salieron esquejes y cuántos, porque de eso nacen plantas nuevas.
    if (task.type === 'esquejado' && newStatus === 'completed') {
      setEsquejandoTask(task)
      return
    }

    const res = await toggleTaskStatus(String(id), newStatus)

    if (res?.error) {
      showToast('Error al actualizar estado', 'error')
      return
    }

    if (newStatus === 'completed') {
      showToast(res?.ambiente ? ambienteMessage(res.ambiente) : completionMessage(res?.effects), 'success')
      return
    }

    // Al desmarcarla, los esquejes ya creados siguen existiendo: son plantas
    // con su propia historia, no un efecto secundario que se pueda deshacer.
    const registered = task.metadata?.esquejado?.total ?? 0
    showToast(
      registered > 0
        ? `Tarea pendiente. Los ${registered} esquejes creados se mantienen.`
        : 'Tarea marcada como pendiente',
      'success'
    )
  }

  // --- Selección múltiple ---

  const handleLongPress = (taskId: string | number) => {
     if (isSelectionMode) return
     setIsSelectionMode(true)
     setSelectedTasks(new Set([taskId]))
     if (typeof navigator !== 'undefined' && navigator.vibrate) {
       navigator.vibrate(50)
     }
  }

  const handleSelectionToggle = (id: string | number) => {
     const newSelected = new Set(selectedTasks)
     if (newSelected.has(id)) newSelected.delete(id)
     else newSelected.add(id)

     if (newSelected.size === 0) setIsSelectionMode(false)
     setSelectedTasks(newSelected)
  }

  const exitSelectionMode = () => {
    setIsSelectionMode(false)
    setSelectedTasks(new Set())
  }

  const handleDeleteSelected = async () => {
    if (selectedTasks.size === 0) return

    setIsDeleting(true)
    const res = await deleteTasks(Array.from(selectedTasks).map(String))
    setIsDeleting(false)

    if (res?.error) {
      showToast('No se pudieron eliminar las tareas', 'error')
    } else {
      showToast('Tareas eliminadas', 'success')
      exitSelectionMode()
    }
  }

  // Ordenar: pendientes primero y, dentro de cada grupo, por fecha.
  const sortedTasks = [...(tasksToDisplay || [])].sort((a, b) => {
    if (a.status === b.status) {
       return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    return a.status === 'pending' ? -1 : 1
  })

  if (!tasksToDisplay || tasksToDisplay.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
        <CheckCircle2 size={26} className="text-fg-subtle" aria-hidden="true" />
        <p className="text-sm font-medium text-fg">
          {disableDateFilter ? 'Sin tareas este día' : 'Nada pendiente para hoy'}
        </p>
        <p className="text-xs text-fg-muted">Podés agendar una desde el botón de nueva tarea.</p>
      </div>
    )
  }

  const pendingTasks = sortedTasks.filter(t => t.status === 'pending')
  const completedTasks = sortedTasks.filter(t => t.status === 'completed')

  const renderPill = (task: Task) => (
    <TaskPill
      key={task.id}
      task={task}
      onComplete={handleToggle}
      onEdit={(t) => setEditingTask(t)}
      selectionMode={isSelectionMode}
      isSelected={selectedTasks.has(task.id)}
      onLongPress={handleLongPress}
      onSelect={handleSelectionToggle}
      onClick={(t) => handleToggle(t.id)}
    />
  )

  return (
    <div className={`space-y-2 ${isSelectionMode ? 'pb-24' : ''}`}>
      {groupByStatus ? (
        <>
           {pendingTasks.length > 0 && (
              <section className="mb-5">
                 <h4 className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-surface py-2 text-xs font-bold text-fg-muted">
                   Pendientes
                   <span className="mono text-fg-subtle">{pendingTasks.length}</span>
                 </h4>
                 <div className="space-y-2">{pendingTasks.map(renderPill)}</div>
              </section>
           )}

           {completedTasks.length > 0 && (
              <section>
                 <h4 className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-surface py-2 text-xs font-bold text-fg-muted">
                   Completadas
                   <span className="mono text-fg-subtle">{completedTasks.length}</span>
                 </h4>
                 <div className="space-y-2">{completedTasks.map(renderPill)}</div>
              </section>
           )}
        </>
      ) : (
        sortedTasks.map(renderPill)
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteSelected}
        title="Eliminar tareas"
        description={`Se eliminarán ${selectedTasks.size} tareas seleccionadas. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
      />

      {editingTask && (
        <EditTaskModal
           isOpen={!!editingTask}
           onClose={() => setEditingTask(null)}
           task={editingTask}
        />
      )}

      {esquejandoTask && (
        <EsquejarModal
           isOpen={!!esquejandoTask}
           onClose={() => setEsquejandoTask(null)}
           task={esquejandoTask}
        />
      )}

      <SelectionBar
        count={isSelectionMode ? selectedTasks.size : 0}
        onClear={exitSelectionMode}
        label="Acciones sobre las tareas seleccionadas"
      >
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isDeleting}
          className="btn btn-sm btn-danger rounded-full"
        >
          {isDeleting
            ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            : <Trash2 size={15} aria-hidden="true" />}
          Eliminar
        </button>
      </SelectionBar>
    </div>
  )
}
