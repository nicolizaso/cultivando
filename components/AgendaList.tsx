'use client'

import { useState } from 'react'
import { Task } from "@/app/lib/types"
import TaskPill from "./TaskPill"
import EditTaskModal from "./EditTaskModal"
import { toggleTaskStatus, deleteTasks } from "@/app/actions/tasks"
import { useToast } from "@/app/context/ToastContext"
import { CheckCircle2, Trash2, X, Loader2 } from "lucide-react"
import ConfirmDialog from "@/components/ui/ConfirmDialog"

interface AgendaListProps {
  tasks: Task[]
  disableDateFilter?: boolean
  groupByStatus?: boolean
}

export default function AgendaList({ tasks, disableDateFilter = false, groupByStatus = false }: AgendaListProps) {
  const { showToast } = useToast()

  // Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedTasks, setSelectedTasks] = useState<Set<string | number>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // Filter tasks for today using local time
  const todayStr = new Date().toLocaleDateString('en-CA');
  const tasksToDisplay = disableDateFilter
    ? tasks
    : tasks.filter(t => t.due_date && t.due_date.split('T')[0] === todayStr);

  const handleToggle = async (id: string | number) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return

    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    const res = await toggleTaskStatus(String(id), newStatus)

    if (res?.error) {
      showToast('Error al actualizar estado', 'error')
    } else {
      showToast(newStatus === 'completed' ? '¡Tarea completada!' : 'Tarea marcada como pendiente', 'success')
    }
  }

  // --- Selection Logic ---

  const handleLongPress = (taskId: string | number) => {
     if (isSelectionMode) return
     setIsSelectionMode(true)
     setSelectedTasks(new Set([taskId]))
     // Haptic feedback
     if (typeof navigator !== 'undefined' && navigator.vibrate) {
       navigator.vibrate(50)
     }
  }

  const handleSelectionToggle = (id: string | number) => {
     const newSelected = new Set(selectedTasks)
     if (newSelected.has(id)) {
       newSelected.delete(id)
     } else {
       newSelected.add(id)
     }

     if (newSelected.size === 0) {
       setIsSelectionMode(false)
     }
     setSelectedTasks(newSelected)
  }

  const exitSelectionMode = () => {
    setIsSelectionMode(false)
    setSelectedTasks(new Set())
  }

  const handleDeleteSelected = async () => {
    if (selectedTasks.size === 0) return

    setIsDeleting(true)
    // Convert all IDs to strings for the server action
    const res = await deleteTasks(Array.from(selectedTasks).map(String))
    setIsDeleting(false)

    if (res?.error) {
      showToast('No se pudieron eliminar las tareas', 'error')
    } else {
      showToast('Tareas eliminadas', 'success')
      exitSelectionMode()
    }
  }

  // Ordenar: Pendientes primero, luego completadas.
  const sortedTasks = [...(tasksToDisplay || [])].sort((a, b) => {
    // If grouping, sort by pending first
    if (a.status === b.status) {
       // Secondary sort by date
       return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    return a.status === 'pending' ? -1 : 1
  })

  if (!tasksToDisplay || tasksToDisplay.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
        <CheckCircle2 size={28} className="text-fg-subtle" aria-hidden="true" />
        <span className="text-sm text-fg-muted">
          No hay tareas {disableDateFilter ? 'para esta fecha' : 'para hoy'}
        </span>
      </div>
    )
  }

  const pendingTasks = sortedTasks.filter(t => t.status === 'pending')
  const completedTasks = sortedTasks.filter(t => t.status === 'completed')

  return (
    <div className={`space-y-2 pr-2 ${isSelectionMode ? 'pb-24' : ''}`}>
      {groupByStatus ? (
        <>
           {/* Pending Section */}
           {pendingTasks.length > 0 && (
              <div className="mb-4">
                 <h4 className="sticky top-0 z-10 mb-2 border-b border-line bg-surface py-2 text-xs font-bold uppercase tracking-widest text-fg-subtle">Pendientes ({pendingTasks.length})</h4>
                 <div className="space-y-2">
                    {pendingTasks.map(task => (
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
                    ))}
                 </div>
              </div>
           )}

           {/* Completed Section */}
           {completedTasks.length > 0 && (
              <div className="mb-4">
                 <h4 className="sticky top-0 z-10 mb-2 border-b border-line bg-surface py-2 text-xs font-bold uppercase tracking-widest text-fg-subtle">Completadas ({completedTasks.length})</h4>
                 <div className="space-y-2">
                    {completedTasks.map(task => (
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
                    ))}
                 </div>
              </div>
           )}
        </>
      ) : (
        sortedTasks.map((task) => (
          <TaskPill
            key={task.id}
            task={task}
            onComplete={handleToggle} // Keep original prop for backward compat/button logic
            onEdit={(t) => setEditingTask(t)}

            // Selection Props
            selectionMode={isSelectionMode}
            isSelected={selectedTasks.has(task.id)}
            onLongPress={handleLongPress}
            onSelect={handleSelectionToggle}
            onClick={(t) => handleToggle(t.id)} // Used when NOT in selection mode
          />
        ))
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

      {/* Floating Action Bar */}
      {isSelectionMode && (
        <div
          role="toolbar"
          aria-label="Acciones sobre las tareas seleccionadas"
          className="animate-sheet-in surface fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex w-[90%] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-[var(--radius-lg)] p-3 shadow-[var(--shadow-lg)] md:bottom-6"
        >
           <p className="flex items-center gap-2.5 pl-1 text-sm font-semibold text-fg" aria-live="polite">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-[color:var(--brand-text)]" aria-hidden="true">
                <CheckCircle2 size={18} />
              </span>
              {selectedTasks.size} seleccionada{selectedTasks.size !== 1 ? 's' : ''}
           </p>

           <div className="flex items-center gap-1">
             <button
               type="button"
               onClick={exitSelectionMode}
               className="btn-icon"
               disabled={isDeleting}
               aria-label="Salir del modo selección"
             >
               <X size={20} aria-hidden="true" />
             </button>
             <button
               type="button"
               onClick={() => setShowDeleteConfirm(true)}
               disabled={isDeleting}
               className="btn-icon text-[color:var(--danger)]"
               aria-label={`Eliminar ${selectedTasks.size} tareas`}
             >
               {isDeleting ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Trash2 size={20} aria-hidden="true" />}
             </button>
           </div>
        </div>
      )}
    </div>
  )
}
