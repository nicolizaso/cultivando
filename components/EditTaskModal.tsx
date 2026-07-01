'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Repeat, Trash2, AlertTriangle, ChevronDown } from 'lucide-react'
import { updateTask, deleteTask, deleteTaskSeries } from '@/app/actions/tasks'
import { Task } from '@/app/lib/types'
import { useToast } from '@/app/context/ToastContext'
import DatePicker from './DatePicker'
import { useRouter } from 'next/navigation'

interface EditTaskModalProps {
  isOpen: boolean
  onClose: () => void
  task: Task
}

export default function EditTaskModal({ isOpen, onClose, task }: EditTaskModalProps) {
  const { showToast } = useToast()
  const router = useRouter()

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [applicationType, setApplicationType] = useState(task.application_type || 'Riego')
  const [targetStage, setTargetStage] = useState(task.target_stage || 'Vegetativo')
  // Initial date state, updated in useEffect
  const [date, setDate] = useState(() => {
    return new Date(task.due_date).toLocaleDateString('en-CA')
  })

  const [scope, setScope] = useState<'single' | 'all_future'>('single')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteOptions, setShowDeleteOptions] = useState(false)

  useEffect(() => {
    if (isOpen && task) {
       setTitle(task.title)
       setDescription(task.description || '')
       setApplicationType(task.application_type || 'Riego')
       setTargetStage(task.target_stage || 'Vegetativo')
       // Ensure we get YYYY-MM-DD from the task date
       const d = new Date(task.due_date)
       setDate(d.toLocaleDateString('en-CA'))
       setScope('single')
       setShowDeleteOptions(false)
    }
  }, [isOpen, task])

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!title.trim()) {
      showToast('El título es obligatorio', 'error')
      return
    }

    setIsSubmitting(true)

    // Prepare updates
    const updates = {
       title,
       description,
       application_type: task.type === 'fertilizante' ? applicationType : undefined,
       target_stage: task.type === 'cambio_etapa' ? targetStage : undefined,
       date: `${date}T12:00:00` // Append noon to avoid timezone shifts
    }

    const result = await updateTask(task.id, updates, scope, task.recurrence_id)

    setIsSubmitting(false)

    if (result?.error) {
       showToast(result.error, 'error')
    } else {
       showToast('Tarea actualizada', 'success')
       router.refresh()
       onClose()
    }
  }

  const handleDeleteClick = async () => {
    if (task.recurrence_id) {
      setShowDeleteOptions(true)
    } else {
      if (!window.confirm('¿Estás seguro de que deseas eliminar esta tarea?')) return

      setIsDeleting(true)
      const res = await deleteTask(task.id)
      setIsDeleting(false)

      if (res?.error) {
        showToast(res.error, 'error')
      } else {
        showToast('Tarea eliminada', 'success')
        router.refresh()
        onClose()
      }
    }
  }

  const handleSeriesDelete = async (seriesScope: 'this' | 'series') => {
    setIsDeleting(true)
    const res = await deleteTaskSeries(task.recurrence_id!, task.id, seriesScope)
    setIsDeleting(false)

    if (res?.error) {
      showToast(res.error, 'error')
    } else {
      showToast(seriesScope === 'series' ? 'Serie eliminada' : 'Tarea eliminada', 'success')
      router.refresh()
      onClose()
    }
  }

  if (showDeleteOptions) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-card border border-card-border w-full max-w-sm rounded-2xl shadow-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
           <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-2">
                 <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-foreground">Tarea Recurrente</h3>
              <p className="text-sm text-muted">Esta tarea se repite en el tiempo. ¿Qué deseas eliminar?</p>

              <div className="space-y-2 mt-4 flex flex-col">
                 <button
                   onClick={() => handleSeriesDelete('this')}
                   disabled={isDeleting}
                   className="w-full bg-background hover:bg-card-border border border-card-border text-foreground font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
                 >
                   Solo esta tarea
                 </button>
                 <button
                   onClick={() => handleSeriesDelete('series')}
                   disabled={isDeleting}
                   className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
                 >
                   {isDeleting ? 'Eliminando...' : 'Toda la serie'}
                 </button>
              </div>

              <button
                onClick={() => setShowDeleteOptions(false)}
                disabled={isDeleting}
                className="mt-4 text-sm text-muted hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
           </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-card-border w-full max-w-md rounded-2xl shadow-sm flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-card-border">
          <h2 className="text-xl font-bold text-foreground tracking-wide">Editar Tarea</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">

           {/* Title */}
           <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted ml-1">Título</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-background border border-card-border rounded-xl py-3 px-4 text-foreground text-sm outline-none focus:border-brand-primary/50 transition-colors"
                placeholder="Nombre de la tarea"
              />
           </div>

           {/* Date */}
           <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted ml-1">Fecha</label>
              <DatePicker selectedDate={date} onChange={setDate} />
           </div>

           {/* Application Type */}
           {task.type === 'fertilizante' && (
             <div className="space-y-1.5 animate-in slide-in-from-top-1">
               <label className="text-[10px] uppercase font-bold text-muted ml-1">Tipo de Aplicación</label>
               <div className="relative">
                 <select
                   value={applicationType}
                   onChange={(e) => setApplicationType(e.target.value)}
                   className="w-full bg-background border border-card-border rounded-xl py-3 px-3 text-foreground text-sm outline-none focus:border-brand-primary/50 appearance-none pr-10"
                 >
                   <option value="Riego">Riego</option>
                   <option value="Foliar">Foliar</option>
                   <option value="Directo al Sustrato">Directo al Sustrato</option>
                 </select>
                 <ChevronDown size={16} className="text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
               </div>
             </div>
           )}

           {/* Target Stage */}
           {task.type === 'cambio_etapa' && (
             <div className="space-y-1.5 animate-in slide-in-from-top-1">
               <label className="text-[10px] uppercase font-bold text-muted ml-1">Etapa Destino</label>
               <div className="relative">
                 <select
                   value={targetStage}
                   onChange={(e) => setTargetStage(e.target.value)}
                   className="w-full bg-background border border-card-border rounded-xl py-3 px-3 text-foreground text-sm outline-none focus:border-brand-primary/50 appearance-none pr-10"
                 >
                   <option value="Germinación">Germinación</option>
                   <option value="Plántula">Plántula</option>
                   <option value="Vegetativo">Vegetativo</option>
                   <option value="Enraizamiento">Enraizamiento</option>
                   <option value="Floración">Floración</option>
                   <option value="Secado">Secado</option>
                   <option value="Curado">Curado</option>
                 </select>
                 <ChevronDown size={16} className="text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
               </div>
             </div>
           )}

           {/* Description */}
           <div className="space-y-1.5">
             <label className="text-[10px] uppercase font-bold text-muted ml-1">Detalles</label>
             <textarea
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               rows={3}
               className="w-full bg-background border border-card-border rounded-xl py-3 px-4 text-foreground text-sm outline-none focus:border-brand-primary/50 transition-colors resize-none"
               placeholder="Notas adicionales..."
             />
           </div>

           {/* Recurrence Scope */}
           {task.recurrence_id && (
             <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-brand-primary">
                   <Repeat size={18} />
                   <span className="text-sm font-bold">Serie Recurrente</span>
                </div>
                <p className="text-xs text-muted">Esta tarea es parte de una serie. ¿Cómo quieres aplicar los cambios?</p>

                <div className="space-y-2">
                   <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${scope === 'single' ? 'bg-brand-primary/20 border-brand-primary/50' : 'bg-background border-card-border hover:border-slate-300'}`}>
                      <input
                        type="radio"
                        name="scope"
                        value="single"
                        checked={scope === 'single'}
                        onChange={() => setScope('single')}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${scope === 'single' ? 'border-brand-primary' : 'border-slate-500'}`}>
                         {scope === 'single' && <div className="w-2 h-2 rounded-full bg-brand-primary" />}
                      </div>
                      <span className={`text-sm ${scope === 'single' ? 'text-foreground font-bold' : 'text-foreground'}`}>Solo esta tarea</span>
                   </label>

                   <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${scope === 'all_future' ? 'bg-brand-primary/20 border-brand-primary/50' : 'bg-background border-card-border hover:border-slate-300'}`}>
                      <input
                        type="radio"
                        name="scope"
                        value="all_future"
                        checked={scope === 'all_future'}
                        onChange={() => setScope('all_future')}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${scope === 'all_future' ? 'border-brand-primary' : 'border-slate-500'}`}>
                         {scope === 'all_future' && <div className="w-2 h-2 rounded-full bg-brand-primary" />}
                      </div>
                      <div className="flex flex-col">
                         <span className={`text-sm ${scope === 'all_future' ? 'text-foreground font-bold' : 'text-foreground'}`}>Esta y todas las futuras</span>
                         <span className="text-[10px] text-muted">Moverá todas las fechas proporcionalmente</span>
                      </div>
                   </label>
                </div>
             </div>
           )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-card-border bg-background/50 flex gap-3">
          <button
            onClick={handleDeleteClick}
            disabled={isSubmitting || isDeleting}
            className="w-14 shrink-0 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            title="Eliminar tarea"
          >
            {isDeleting ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
          </button>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isDeleting}
            className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] shadow-[0_0_15px_rgba(0,165,153,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'GUARDAR CAMBIOS'}
          </button>
        </div>

      </div>
    </div>
  )
}
