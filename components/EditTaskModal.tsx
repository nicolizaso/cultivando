'use client'

import { useState, useEffect } from 'react'
import { Loader2, Repeat, Trash2, AlertTriangle } from 'lucide-react'
import { updateTask, deleteTask, deleteTaskSeries } from '@/app/actions/tasks'
import { Task } from '@/app/lib/types'
import { useToast } from '@/app/context/ToastContext'
import DatePicker from './DatePicker'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

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
  const [date, setDate] = useState(() => {
    return new Date(task.due_date).toLocaleDateString('en-CA')
  })

  const [scope, setScope] = useState<'single' | 'all_future'>('single')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteOptions, setShowDeleteOptions] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (isOpen && task) {
       setTitle(task.title)
       setDescription(task.description || '')
       setApplicationType(task.application_type || 'Riego')
       setTargetStage(task.target_stage || 'Vegetativo')
       const d = new Date(task.due_date)
       setDate(d.toLocaleDateString('en-CA'))
       setScope('single')
       setShowDeleteOptions(false)
       setShowDeleteConfirm(false)
    }
  }, [isOpen, task])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      showToast('El título es obligatorio', 'error')
      return
    }

    setIsSubmitting(true)

    const updates = {
       title,
       description,
       application_type: task.type === 'fertilizante' ? applicationType : undefined,
       target_stage: task.type === 'cambio_etapa' ? targetStage : undefined,
       date: `${date}T12:00:00` // Mediodía para evitar desfases de zona horaria
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

  const handleDeleteClick = () => {
    if (task.recurrence_id) {
      setShowDeleteOptions(true)
    } else {
      setShowDeleteConfirm(true)
    }
  }

  const handleSingleDelete = async () => {
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

  const scopeOptions: Array<{ value: 'single' | 'all_future'; label: string; hint?: string }> = [
    { value: 'single', label: 'Solo esta tarea' },
    { value: 'all_future', label: 'Esta y todas las futuras', hint: 'Mueve las fechas proporcionalmente' },
  ]

  if (showDeleteOptions) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={() => setShowDeleteOptions(false)}
        title="Tarea recurrente"
        size="sm"
        dismissOnBackdrop={!isDeleting}
      >
        <div className="space-y-5">
          <div className="flex gap-4">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
              aria-hidden="true"
            >
              <AlertTriangle size={20} />
            </span>
            <p className="text-sm leading-relaxed text-fg-muted">
              Esta tarea se repite en el tiempo. Elegí qué querés eliminar.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleSeriesDelete('this')}
              disabled={isDeleting}
              className="btn btn-secondary w-full"
              data-autofocus
            >
              Solo esta tarea
            </button>
            <button
              type="button"
              onClick={() => handleSeriesDelete('series')}
              disabled={isDeleting}
              className="btn btn-danger w-full"
            >
              {isDeleting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {isDeleting ? 'Eliminando...' : 'Toda la serie'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteOptions(false)}
              disabled={isDeleting}
              className="btn btn-ghost w-full"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <>
      <Modal
        isOpen={isOpen && !showDeleteConfirm}
        onClose={onClose}
        title="Editar tarea"
        dismissOnBackdrop={false}
        footer={
          <>
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={isSubmitting || isDeleting}
              className="btn btn-danger mr-auto"
            >
              {isDeleting ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 size={16} aria-hidden="true" />
              )}
              Eliminar
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              form="edit-task-form"
              disabled={isSubmitting || isDeleting}
              className="btn btn-primary"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </>
        }
      >
        <form id="edit-task-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="field">
            <label htmlFor="edit-task-title" className="field-label">Título</label>
            <input
              id="edit-task-title"
              data-autofocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="field-input"
              placeholder="Nombre de la tarea"
            />
          </div>

          <div className="field">
            <label htmlFor="edit-task-date" className="field-label">Fecha</label>
            <DatePicker id="edit-task-date" selectedDate={date} onChange={setDate} />
          </div>

          {task.type === 'fertilizante' && (
            <div className="field">
              <label htmlFor="edit-task-application" className="field-label">Tipo de aplicación</label>
              <select
                id="edit-task-application"
                value={applicationType}
                onChange={(e) => setApplicationType(e.target.value)}
                className="field-input"
              >
                <option value="Riego">Riego</option>
                <option value="Foliar">Foliar</option>
                <option value="Directo al Sustrato">Directo al sustrato</option>
              </select>
            </div>
          )}

          {task.type === 'cambio_etapa' && (
            <div className="field">
              <label htmlFor="edit-task-stage" className="field-label">Etapa destino</label>
              <select
                id="edit-task-stage"
                value={targetStage}
                onChange={(e) => setTargetStage(e.target.value)}
                className="field-input"
              >
                <option value="Germinación">Germinación</option>
                <option value="Plántula">Plántula</option>
                <option value="Vegetativo">Vegetativo</option>
                <option value="Enraizamiento">Enraizamiento</option>
                <option value="Floración">Floración</option>
                <option value="Secado">Secado</option>
                <option value="Curado">Curado</option>
              </select>
            </div>
          )}

          <div className="field">
            <label htmlFor="edit-task-description" className="field-label">Detalles</label>
            <textarea
              id="edit-task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="field-input resize-none"
              placeholder="Notas adicionales"
            />
          </div>

          {task.recurrence_id && (
            <fieldset className="rounded-[var(--radius-lg)] border border-line bg-brand-soft p-4">
              <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-[color:var(--brand-text)]">
                <Repeat size={16} aria-hidden="true" />
                Serie recurrente
              </legend>

              <p className="mb-3 text-xs text-fg-muted">Elegí cómo aplicar los cambios.</p>

              <div className="space-y-2">
                {scopeOptions.map((option) => {
                  const checked = scope === option.value
                  return (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border p-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--ring)] ${
                        checked
                          ? 'border-[color:var(--brand)] bg-surface'
                          : 'border-line bg-surface-2 hover:border-line-strong'
                      }`}
                    >
                      <input
                        type="radio"
                        name="scope"
                        value={option.value}
                        checked={checked}
                        onChange={() => setScope(option.value)}
                        className="sr-only"
                      />
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          checked ? 'border-[color:var(--brand)]' : 'border-line-strong'
                        }`}
                        aria-hidden="true"
                      >
                        {checked && <span className="h-2 w-2 rounded-full bg-brand" />}
                      </span>
                      <span className="flex flex-col">
                        <span className={`text-sm ${checked ? 'font-semibold text-fg' : 'text-fg'}`}>{option.label}</span>
                        {option.hint && <span className="text-xs text-fg-muted">{option.hint}</span>}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleSingleDelete}
        title="Eliminar tarea"
        description={`Se eliminará "${task.title}". Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
      />
    </>
  )
}
