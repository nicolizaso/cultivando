'use client'

import { useRef, useState } from 'react'
import { Loader2, Repeat, Trash2, AlertTriangle } from 'lucide-react'
import { updateTask, deleteTask, deleteTaskSeries } from '@/app/actions/tasks'
import { Task } from '@/app/lib/types'
import { useToast } from '@/app/context/ToastContext'
import { dateKey, todayKey } from '@/app/lib/dates'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { getTaskType } from '@/app/lib/constants'
import { STAGE_NAMES } from '@/app/lib/stage-logic'
import {
  APPLICATION_OPTIONS, ChoiceGroup, DateField, Field, FormActions, Input, Textarea, stageOptions, useFieldErrors,
} from '@/components/ui/form'
import type { ChoiceOption } from '@/components/ui/form'

const STAGE_OPTIONS = stageOptions(STAGE_NAMES)

interface EditTaskModalProps {
  isOpen: boolean
  onClose: () => void
  task: Task
}

/**
 * Se monta con la tarea a editar (y `key={task.id}`): el formulario arranca
 * con sus datos, sin un efecto que los copie al abrir.
 */
export default function EditTaskModal({ isOpen, onClose, task }: EditTaskModalProps) {
  const { showToast } = useToast()
  const router = useRouter()

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [applicationType, setApplicationType] = useState(task.application_type || 'Riego')
  const [targetStage, setTargetStage] = useState(task.target_stage || 'Vegetativo')
  // El día de la tarea en Argentina, no en el huso del navegador.
  const [date, setDate] = useState(() => dateKey(task.due_date) ?? todayKey())

  const [scope, setScope] = useState<'single' | 'all_future'>('single')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteOptions, setShowDeleteOptions] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const { errors, validate, clear } = useFieldErrors<'title'>()


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate({ title: !title.trim() && 'La tarea necesita un título.' }, formRef.current)) return

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

  const scopeOptions: ChoiceOption<'single' | 'all_future'>[] = [
    { value: 'single', label: 'Sólo esta', description: 'Las demás quedan como están' },
    { value: 'all_future', label: 'Esta y las que siguen', description: 'Corre las fechas en la misma medida' },
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

  const typeDef = getTaskType(task.type)

  return (
    <>
      <Modal
        isOpen={isOpen && !showDeleteConfirm}
        onClose={onClose}
        title="Editar tarea"
        dismissOnBackdrop={false}
        footer={
          <FormActions
            form="edit-task-form"
            onCancel={onClose}
            pending={isSubmitting}
            disabled={isDeleting}
            submitLabel="Guardar cambios"
            extra={
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={isSubmitting || isDeleting}
                className="btn btn-danger"
                aria-label="Eliminar tarea"
              >
                {isDeleting ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 size={16} aria-hidden="true" />
                )}
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            }
          />
        }
      >
        <form id="edit-task-form" ref={formRef} onSubmit={handleSubmit} className="space-y-6" noValidate>
          <Field label="Título" error={errors.title}>
            <Input
              data-autofocus
              type="text"
              autoComplete="off"
              leading={<span className={typeDef.color}><typeDef.icon size={18} /></span>}
              value={title}
              onChange={(e) => { setTitle(e.target.value); clear('title') }}
              placeholder="Nombre de la tarea"
            />
          </Field>

          <DateField label="Día" value={date} onChange={setDate} quick="future" />

          {task.type === 'fertilizante' && (
            <ChoiceGroup
              legend="Cómo se aplica"
              options={APPLICATION_OPTIONS}
              value={applicationType}
              onChange={setApplicationType}
              size="sm"
            />
          )}

          {task.type === 'cambio_etapa' && (
            <ChoiceGroup
              legend="Pasa a"
              options={STAGE_OPTIONS}
              value={targetStage}
              onChange={setTargetStage}
              size="sm"
            />
          )}

          <Field label="Detalles" optional>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notas adicionales"
            />
          </Field>

          {task.recurrence_id && (
            <ChoiceGroup
              legend={
                <span className="inline-flex items-center gap-1.5">
                  <Repeat size={15} className="text-[color:var(--brand-text)]" aria-hidden="true" />
                  Es parte de una serie: ¿a cuáles se aplica?
                </span>
              }
              variant="tile"
              layout="grid grid-cols-1 gap-2 sm:grid-cols-2"
              options={scopeOptions}
              value={scope}
              onChange={setScope}
            />
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
