'use client'

import { useRef, useState } from 'react'
import { CheckCircle2, Loader2, Trash2 } from 'lucide-react'
import { Task } from "@/app/lib/types"
import TaskPill from "./TaskPill"
import EditTaskModal from "./EditTaskModal"
import EsquejarModal from "./EsquejarModal"
import CompleteTaskSheet from "./CompleteTaskSheet"
import { completeTask, deleteTasks, reopenTask } from "@/app/actions/tasks"
import type { CompleteTaskInput } from "@/app/actions/tasks"
import { hasStoredMix } from "@/app/lib/nutrition"
import { completionNeeds } from "@/app/lib/task-effects"
import { useToast } from "@/app/context/ToastContext"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import SelectionBar from "@/components/ui/SelectionBar"

interface AgendaListProps {
  tasks: Task[]
  groupByStatus?: boolean
  /** Lo que se dice si no hay tareas. */
  emptyLabel?: string
}

export default function AgendaList({ tasks, groupByStatus = false, emptyLabel = 'Sin tareas este día' }: AgendaListProps) {
  const { showToast } = useToast()

  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedTasks, setSelectedTasks] = useState<Set<string | number>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [esquejandoTask, setEsquejandoTask] = useState<Task | null>(null)
  const [completingTask, setCompletingTask] = useState<Task | null>(null)
  const [reopeningTask, setReopeningTask] = useState<Task | null>(null)

  // Tareas con un cambio en curso: un segundo toque mientras tanto no hace nada.
  const busy = useRef(new Set<string | number>())

  /** Desmarca (y deshace). También es lo que hace "Deshacer" en el aviso. */
  const reopen = async (task: Task) => {
    if (busy.current.has(task.id)) return
    busy.current.add(task.id)
    try {
      const res = await reopenTask(String(task.id))
      if ('error' in res) showToast(res.error, 'error')
      else showToast(res.message, res.tone)
    } finally {
      busy.current.delete(task.id)
    }
  }

  /** Completa y cuenta lo que pasó; devuelve si salió bien. */
  const complete = async (task: Task, input?: CompleteTaskInput): Promise<boolean> => {
    if (busy.current.has(task.id)) return false
    busy.current.add(task.id)
    try {
      const res = await completeTask(String(task.id), input)
      if ('error' in res) {
        showToast(res.error, 'error')
        return false
      }
      showToast(
        res.message,
        res.tone,
        res.canUndo ? { action: { label: 'Deshacer', onClick: () => reopen(task) } } : undefined
      )
      return true
    } finally {
      busy.current.delete(task.id)
    }
  }

  const handleToggle = async (id: string | number) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return

    if (task.status === 'completed') {
      // Desmarcar deshace lo que hizo: si cambió algo, se confirma.
      if (task.metadata?.last_effect) setReopeningTask(task)
      else await reopen(task)
      return
    }

    // El esquejado no se completa de un toque: primero hay que decir de qué
    // plantas salieron esquejes y cuántos, porque de eso nacen plantas nuevas.
    if (task.type === 'esquejado') {
      setEsquejandoTask(task)
      return
    }

    // Si hay algo que preguntar (el día de una atrasada, los litros, los
    // pesos, el destino) se abre la hoja; si no, un toque alcanza.
    if (completionNeeds(task, hasStoredMix(task.metadata)).any) {
      setCompletingTask(task)
      return
    }

    await complete(task)
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
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.status === b.status) {
       return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    return a.status === 'pending' ? -1 : 1
  })

  if (tasks.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
        <CheckCircle2 size={26} className="text-fg-subtle" aria-hidden="true" />
        <p className="text-sm font-medium text-fg">{emptyLabel}</p>
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

      <ConfirmDialog
        isOpen={!!reopeningTask}
        onClose={() => setReopeningTask(null)}
        onConfirm={async () => {
          if (reopeningTask) await reopen(reopeningTask)
        }}
        tone="brand"
        title="¿Volver a pendiente?"
        description="Se deshace lo que hizo en las plantas y se borra su registro de la bitácora. Lo que cambiaste a mano después no se toca."
        confirmLabel="Desmarcar y deshacer"
      />

      {editingTask && (
        <EditTaskModal
           key={editingTask.id}
           isOpen={!!editingTask}
           onClose={() => setEditingTask(null)}
           task={editingTask}
        />
      )}

      {completingTask && (
        <CompleteTaskSheet
          key={completingTask.id}
          task={completingTask}
          onClose={() => setCompletingTask(null)}
          onSubmit={(input) => complete(completingTask, input)}
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
