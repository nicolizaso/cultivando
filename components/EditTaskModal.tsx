'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Repeat, Trash2, AlertTriangle, Warehouse } from 'lucide-react'
import { updateTask, deleteTask, deleteTaskSeries, getSpaceOptions, getTaskFeedContext } from '@/app/actions/tasks'
import { Task } from '@/app/lib/types'
import { useToast } from '@/app/context/ToastContext'
import { dateKey, daysBetweenKeys, todayKey } from '@/app/lib/dates'
import { hasStoredMix, readStoredMix, stageDaysForWeek, stripRecipe, weekInStage } from '@/app/lib/nutrition'
import type { MixItem } from '@/app/lib/nutrition'
import NutrientPicker, { useNutritionOptions } from '@/components/NutrientPicker'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { getTaskType } from '@/app/lib/constants'
import { STAGE_NAMES } from '@/app/lib/stage-logic'
import {
  APPLICATION_OPTIONS, ChoiceGroup, ChoiceOrSelect, DateField, Field, FormActions, FormAlert, Input, Textarea, stageOptions, useFieldErrors,
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
 *
 * Una tarea completada ya hizo lo suyo en las plantas: sólo se editan sus
 * notas. El título sólo se elige en "Otro"; en el resto lo da el tipo.
 */
export default function EditTaskModal({ isOpen, onClose, task }: EditTaskModalProps) {
  const { showToast } = useToast()
  const router = useRouter()

  const isCompleted = task.status === 'completed'
  const canEditTitle = task.type === 'otro' && !isCompleted
  const isFeed = task.type === 'fertilizante' && !isCompleted
  const hadMix = task.type === 'fertilizante' && hasStoredMix(task.metadata)
  const isMove = task.type === 'ambiente' && !isCompleted

  const [title, setTitle] = useState(task.title)
  // Con mezcla guardada, la receta se arma sola: acá se editan sólo las notas.
  const [description, setDescription] = useState(() => (hadMix ? stripRecipe(task.description) : task.description || ''))
  const [applicationType, setApplicationType] = useState(task.application_type || 'Riego')
  const [targetStage, setTargetStage] = useState(task.target_stage || 'Vegetativo')
  // El día de la tarea en Argentina, no en el huso del navegador.
  const [date, setDate] = useState(() => dateKey(task.due_date) ?? todayKey())
  const [targetSpaceId, setTargetSpaceId] = useState<number | null>(task.target_space_id ?? null)
  const [spaces, setSpaces] = useState<{ id: number; name: string }[] | null>(null)

  const [scope, setScope] = useState<'single' | 'all_future'>('single')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteOptions, setShowDeleteOptions] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const { errors, validate, clear } = useFieldErrors<'title'>()

  // Mezcla: la guardada (las tareas viejas con un combo necesitan los combos
  // para saber qué productos tenía, por eso puede arrancar sin saberse).
  const nutrition = useNutritionOptions()
  const { load } = nutrition
  const stored = readStoredMix(task.metadata, nutrition.options?.combos, nutrition.options?.fertilizers)
  // null = sin tocar: vale la guardada.
  const [mixDraft, setMixDraft] = useState<MixItem[] | null>(null)
  const mix = mixDraft ?? (!hadMix ? [] : stored ? stored.items : nutrition.options ? [] : null)
  const [context, setContext] = useState<{ stageDaysToday: number | null; stages: string[] } | null>(null)
  const [weekOverride, setWeekOverride] = useState<number | null>(null)

  useEffect(() => {
    if (!isFeed) return
    let cancelled = false
    load()
    getTaskFeedContext(task.id).then((result) => { if (!cancelled) setContext(result) })
    return () => { cancelled = true }
  }, [isFeed, load, task.id])

  // Los espacios, para el destino de una mudanza.
  useEffect(() => {
    if (!isMove) return
    let cancelled = false
    getSpaceOptions().then((result) => { if (!cancelled) setSpaces(result) })
    return () => { cancelled = true }
  }, [isMove])

  // La semana el día elegido: la guardada corrida los días que se movió la
  // tarea o, si no tenía mezcla, la de las plantas hoy.
  const originalDay = dateKey(task.due_date) ?? todayKey()
  const savedStageDays = stored?.stage_days ?? null
  const autoStageDays = Math.max(0, savedStageDays !== null
    ? savedStageDays + daysBetweenKeys(originalDay, date)
    : (context?.stageDaysToday ?? 0) + daysBetweenKeys(todayKey(), date))
  const week = weekOverride ?? weekInStage(autoStageDays)
  const stageDays = weekOverride !== null ? stageDaysForWeek(weekOverride) : autoStageDays
  const mixReady = !isFeed || mix !== null


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (canEditTitle && !validate({ title: !title.trim() && 'La tarea necesita un título.' }, formRef.current)) return

    setIsSubmitting(true)

    // Completada: sólo las notas. El servidor aplica la misma regla.
    const updates = isCompleted ? { description } : {
       title,
       description,
       application_type: task.type === 'fertilizante' ? applicationType : undefined,
       target_stage: task.type === 'cambio_etapa' ? targetStage : undefined,
       target_space_id: isMove ? targetSpaceId : undefined,
       date: `${date}T12:00:00`, // Mediodía para evitar desfases de zona horaria
       // La mezcla como datos: el servidor arma la receta (y en una serie, la
       // de cada fecha con su semana).
       ...(isFeed && mix !== null ? { nutrition: mix.length > 0 ? { items: mix, stage_days: stageDays } : null } : {}),
    }

    const result = await updateTask(task.id, updates, isCompleted ? 'single' : scope)

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
            disabled={isDeleting || !mixReady}
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
          {canEditTitle ? (
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
          ) : (
            <p className="flex items-center gap-2.5 text-base font-semibold text-fg">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${typeDef.bg} ${typeDef.color}`}
                aria-hidden="true"
              >
                <typeDef.icon size={16} />
              </span>
              {task.title}
            </p>
          )}

          {isCompleted && (
            <FormAlert tone="info">
              Está completada: para cambiar el día o lo que hace, primero desmarcala (se deshacen sus cambios).
            </FormAlert>
          )}

          {!isCompleted && <DateField label="Día" value={date} onChange={setDate} quick="future" />}

          {isFeed && (
            <>
              <NutrientPicker
                options={nutrition.options}
                state={nutrition.state}
                onReload={nutrition.reload}
                value={mix ?? []}
                onChange={setMixDraft}
                week={week}
                onWeekChange={setWeekOverride}
                weekNote={weekOverride !== null ? (
                  <>
                    Semana elegida a mano.{' '}
                    <button type="button" className="font-semibold text-[color:var(--brand-text)]" onClick={() => setWeekOverride(null)}>
                      Volver a la {weekInStage(autoStageDays)}
                    </button>
                  </>
                ) : task.recurrence_id && scope === 'all_future' ? 'Cada tarea de la serie usa la dosis de su semana.' : undefined}
                stages={context?.stages ?? []}
                showRecipe
              />
              <ChoiceGroup
                legend="Cómo se aplica"
                options={APPLICATION_OPTIONS}
                value={applicationType}
                onChange={setApplicationType}
                size="sm"
              />
            </>
          )}

          {isMove && (
            spaces === null ? (
              <p className="flex items-center gap-2 text-sm text-fg-muted">
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                Cargando espacios…
              </p>
            ) : (
              <ChoiceOrSelect
                legend="Se muda a"
                options={spaces.map((space) => ({ value: space.id, label: space.name, icon: <Warehouse size={15} /> }))}
                value={targetSpaceId}
                onChange={setTargetSpaceId}
                size="sm"
              />
            )
          )}

          {task.type === 'cambio_etapa' && !isCompleted && (
            <ChoiceGroup
              legend="Pasa a"
              options={STAGE_OPTIONS}
              value={targetStage}
              onChange={setTargetStage}
              size="sm"
            />
          )}

          <Field label={isFeed ? 'Notas' : 'Detalles'} optional>
            <Textarea
              data-autofocus={!canEditTitle ? true : undefined}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isFeed ? 'Cómo prepararla, en qué orden, lo que haga falta recordar' : 'Notas adicionales'}
            />
          </Field>

          {task.recurrence_id && !isCompleted && (
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
