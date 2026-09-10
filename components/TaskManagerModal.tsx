'use client'

import { useState, useEffect } from 'react'
import { ClipboardList, Trash2, Pencil, Loader2, CheckCircle2 } from 'lucide-react'
import { getAllPendingTasks, deleteTasks } from '@/app/actions/tasks'
import { Task } from '@/app/lib/types'
import { useToast } from '@/app/context/ToastContext'
import EditTaskModal from './EditTaskModal'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface CycleSimple {
  id: number
  name: string
}

export default function TaskManagerModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [cycles, setCycles] = useState<CycleSimple[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTasks, setSelectedTasks] = useState<Set<string | number>>(new Set())
  const [filterCycle, setFilterCycle] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { showToast } = useToast()
  const router = useRouter()

  useEffect(() => {
    if (isOpen) {
      fetchData()
    } else {
      setSelectedTasks(new Set())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const fetchData = async () => {
    setIsLoading(true)
    const res = await getAllPendingTasks()
    setIsLoading(false)

    if (res?.error) {
      showToast('No se pudieron cargar las tareas', 'error')
      return
    }

    if (res.tasks) setTasks(res.tasks)
    if (res.cycles) setCycles(res.cycles)
  }

  const handleToggleSelect = (taskId: string | number) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set())
    } else {
      const allIds = filteredTasks.map(t => t.id)
      setSelectedTasks(new Set(allIds))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedTasks.size === 0) return

    setIsDeleting(true)
    const res = await deleteTasks(Array.from(selectedTasks))
    setIsDeleting(false)

    if (res?.error) {
      showToast('No se pudieron eliminar las tareas', 'error')
    } else {
      showToast(`${selectedTasks.size} tareas eliminadas`, 'success')
      setSelectedTasks(new Set())
      fetchData()
      router.refresh()
    }
  }

  const filteredTasks = tasks.filter(task => {
    if (filterCycle && String(task.cycleId) !== String(filterCycle)) return false
    if (filterType && task.type !== filterType) return false
    return true
  })

  const uniqueTypes = Array.from(new Set(tasks.map(t => t.type))).filter(Boolean)
  const allSelected = filteredTasks.length > 0 && selectedTasks.size === filteredTasks.length

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn-icon"
        aria-label="Abrir gestor de tareas"
        title="Gestor de tareas"
      >
        <ClipboardList size={20} aria-hidden="true" />
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Gestión de tareas"
        description={`${tasks.length} tareas pendientes`}
        size="xl"
      >
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="field flex-1">
              <label htmlFor="manager-filter-cycle" className="field-label">Ciclo</label>
              <select
                id="manager-filter-cycle"
                className="field-input"
                value={filterCycle}
                onChange={(e) => setFilterCycle(e.target.value)}
              >
                <option value="">Todos los ciclos</option>
                {cycles.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="field flex-1">
              <label htmlFor="manager-filter-type" className="field-label">Tipo</label>
              <select
                id="manager-filter-type"
                className="field-input"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">Todos los tipos</option>
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-fg">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                disabled={filteredTasks.length === 0}
                className="field-check"
              />
              Seleccionar todas
            </label>

            {selectedTasks.size > 0 && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
                className="btn btn-danger"
              >
                {isDeleting ? (
                  <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                ) : (
                  <Trash2 size={16} aria-hidden="true" />
                )}
                Eliminar ({selectedTasks.size})
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Cargando tareas">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="skeleton h-16 w-full rounded-[var(--radius-md)]" />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <CheckCircle2 size={40} className="text-fg-subtle" aria-hidden="true" />
              <p className="text-sm text-fg-muted">No hay tareas que coincidan con los filtros.</p>
            </div>
          ) : (
            /* Lista de tarjetas en lugar de tabla: se lee igual en móvil sin scroll lateral */
            <ul className="space-y-2">
              {filteredTasks.map(task => {
                const isSelected = selectedTasks.has(task.id)
                return (
                  <li
                    key={task.id}
                    className={`flex items-start gap-3 rounded-[var(--radius-md)] border p-3 transition-colors ${
                      isSelected ? 'border-[color:var(--brand)] bg-brand-soft' : 'border-line bg-surface-2'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(task.id)}
                      aria-label={`Seleccionar ${task.title}`}
                      className="field-check mt-0.5 shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-fg">{task.title}</p>
                      {task.description && (
                        <p className="truncate text-xs text-fg-muted">{task.description}</p>
                      )}
                      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                        <time dateTime={new Date(task.due_date).toISOString()}>
                          {new Date(task.due_date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </time>
                        <span className="chip chip-neutral">{task.type}</span>
                        {task.cycleName && (
                          <span className="chip chip-brand">
                            {task.cycleName}
                          </span>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditingTask(task)}
                      className="btn-icon shrink-0"
                      aria-label={`Editar ${task.title}`}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Modal>

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
           onClose={() => {
              setEditingTask(null)
              fetchData()
              router.refresh()
           }}
           task={editingTask}
        />
      )}
    </>
  )
}
