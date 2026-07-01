'use client'

import { useState, useEffect } from 'react'
import { ClipboardList, X, Trash2, Pencil, Filter, Loader2, CheckSquare, Square } from 'lucide-react'
import { getAllPendingTasks, deleteTasks } from '@/app/actions/tasks'
import { Task } from '@/app/lib/types'
import { useToast } from '@/app/context/ToastContext'
import EditTaskModal from './EditTaskModal'
import { useRouter } from 'next/navigation'

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

  const { showToast } = useToast()
  const router = useRouter()

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchData()
    } else {
      // Reset selection when closed? Maybe not necessary but good practice
      setSelectedTasks(new Set())
    }
  }, [isOpen])

  const fetchData = async () => {
    setIsLoading(true)
    const res = await getAllPendingTasks()
    setIsLoading(false)

    if (res?.error) {
      showToast('Error al cargar tareas', 'error')
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
    if (!confirm(`¿Estás seguro de eliminar ${selectedTasks.size} tareas?`)) return

    setIsDeleting(true)
    const res = await deleteTasks(Array.from(selectedTasks))
    setIsDeleting(false)

    if (res?.error) {
      showToast('Error al eliminar', 'error')
    } else {
      showToast('Tareas eliminadas', 'success')
      setSelectedTasks(new Set())
      fetchData() // Refresh list
      router.refresh() // Refresh server components
    }
  }

  // Filter Logic
  const filteredTasks = tasks.filter(task => {
    // Filter by Cycle
    if (filterCycle) {
        // cycleId in task might be string or number depending on mapping.
        // In server action we mapped it. Let's assume loose comparison or string conversion.
        if (String(task.cycleId) !== String(filterCycle)) return false
    }
    // Filter by Type
    if (filterType) {
        if (task.type !== filterType) return false
    }
    return true
  })

  // Get unique types for filter
  const uniqueTypes = Array.from(new Set(tasks.map(t => t.type))).filter(Boolean)

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-xl bg-card-border hover:bg-card-border text-muted hover:text-foreground transition-colors"
        title="Gestor de Tareas"
      >
        <ClipboardList size={20} />
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-card-border w-full max-w-4xl rounded-2xl shadow-sm flex flex-col h-[85vh] animate-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-card-border">
              <div>
                <h2 className="text-xl font-bold text-foreground tracking-wide flex items-center gap-2">
                  <ClipboardList className="text-brand-primary" />
                  Gestión Masiva
                </h2>
                <p className="text-xs text-muted mt-1">
                    {tasks.length} tareas pendientes encontradas
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full hover:bg-card-border text-muted hover:text-foreground transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Filters & Actions Bar */}
            <div className="p-4 border-b border-card-border bg-background/30 flex flex-col md:flex-row gap-4 justify-between items-center">

               {/* Filters */}
               <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-2 px-3 py-2 bg-background border border-card-border rounded-xl text-xs text-muted min-w-[140px]">
                     <Filter size={14} />
                     <select
                        className="bg-transparent outline-none w-full appearance-none"
                        value={filterCycle}
                        onChange={(e) => setFilterCycle(e.target.value)}
                     >
                        <option value="">Todos los Ciclos</option>
                        {cycles.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                     </select>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-2 bg-background border border-card-border rounded-xl text-xs text-muted min-w-[140px]">
                     <Filter size={14} />
                     <select
                        className="bg-transparent outline-none w-full appearance-none"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                     >
                        <option value="">Todos los Tipos</option>
                        {uniqueTypes.map(type => (
                            <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                        ))}
                     </select>
                  </div>
               </div>

               {/* Bulk Delete Button */}
               {selectedTasks.size > 0 && (
                 <button
                   onClick={handleDeleteSelected}
                   disabled={isDeleting}
                   className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl text-sm font-bold transition-all w-full md:w-auto justify-center"
                 >
                    {isDeleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                    Eliminar seleccionadas ({selectedTasks.size})
                 </button>
               )}
            </div>

            {/* Tasks List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
               {isLoading ? (
                 <div className="flex flex-col items-center justify-center h-64 text-muted">
                    <Loader2 className="animate-spin mb-2" size={32} />
                    <p>Cargando tareas...</p>
                 </div>
               ) : filteredTasks.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-muted opacity-60">
                    <CheckSquare size={48} className="mb-4 text-foreground" />
                    <p>No hay tareas que coincidan con los filtros</p>
                 </div>
               ) : (
                 <table className="w-full text-left border-collapse">
                    <thead className="bg-background sticky top-0 z-10 text-xs uppercase text-muted font-bold tracking-wider">
                       <tr>
                          <th className="p-4 w-12 text-center border-b border-card-border">
                             <button onClick={handleSelectAll} className="hover:text-foreground transition-colors">
                                {selectedTasks.size === filteredTasks.length && filteredTasks.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                             </button>
                          </th>
                          <th className="p-4 border-b border-card-border">Fecha</th>
                          <th className="p-4 border-b border-card-border w-1/3">Tarea</th>
                          <th className="p-4 border-b border-card-border">Tipo</th>
                          <th className="p-4 border-b border-card-border">Ciclo</th>
                          <th className="p-4 border-b border-card-border text-right">Acciones</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                       {filteredTasks.map(task => {
                          const isSelected = selectedTasks.has(task.id)
                          return (
                             <tr key={task.id} className={`hover:bg-card/[0.02] transition-colors ${isSelected ? 'bg-brand-primary/[0.03]' : ''}`}>
                                <td className="p-4 text-center">
                                   <button onClick={() => handleToggleSelect(task.id)} className={`transition-colors ${isSelected ? 'text-brand-primary' : 'text-muted hover:text-muted'}`}>
                                      {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                   </button>
                                </td>
                                <td className="p-4 text-sm text-muted whitespace-nowrap">
                                   {new Date(task.due_date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="p-4">
                                   <div className="flex flex-col">
                                      <span className="text-sm font-medium text-foreground">{task.title}</span>
                                      {task.description && <span className="text-xs text-muted truncate max-w-[200px]">{task.description}</span>}
                                   </div>
                                </td>
                                <td className="p-4">
                                   <span className="px-2 py-1 rounded text-[10px] uppercase font-bold bg-slate-800 text-muted border border-card-border">
                                      {task.type}
                                   </span>
                                </td>
                                <td className="p-4">
                                   {task.cycleName ? (
                                      <span className="px-2 py-1 rounded text-[10px] uppercase font-bold bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                                         {task.cycleName}
                                      </span>
                                   ) : (
                                      <span className="text-xs text-muted">-</span>
                                   )}
                                </td>
                                <td className="p-4 text-right">
                                   <button
                                      onClick={() => setEditingTask(task)}
                                      className="p-2 rounded-lg hover:bg-card-border text-muted hover:text-foreground transition-colors"
                                      title="Editar"
                                   >
                                      <Pencil size={16} />
                                   </button>
                                </td>
                             </tr>
                          )
                       })}
                    </tbody>
                 </table>
               )}
            </div>

          </div>
        </div>
      )}

      {/* Helper Modal for Editing */}
      {editingTask && (
        <EditTaskModal
           isOpen={!!editingTask}
           onClose={() => {
              setEditingTask(null)
              fetchData() // Refresh list after edit
              router.refresh()
           }}
           task={editingTask}
        />
      )}
    </>
  )
}
