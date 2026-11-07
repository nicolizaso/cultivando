'use client'

import { useMemo, useRef, useState } from 'react'
import { CalendarPlus, GitBranch, Layers, Repeat, Search, Sprout, Warehouse, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createTask } from '@/app/actions/tasks'
import { useToast } from '@/app/context/ToastContext'
import { addDaysToKey, daysBetweenKeys, formatInAppTz, todayKey } from '@/app/lib/dates'
import { TASK_TYPES } from '@/app/lib/constants'
import { STAGE_NAMES } from '@/app/lib/stage-logic'
import { buildOccurrenceDates, type Frequency } from '@/app/lib/recurrence'
import Modal from '@/components/ui/Modal'
import {
  APPLICATION_OPTIONS, ChoiceGroup, DateField, Field, FieldGroup, FormActions, FormAlert, FormSection,
  Input, MultiChoice, Switch, Textarea, stageOptions, taskTypeOptions, useFieldErrors,
} from '@/components/ui/form'
import NutrientPicker, { useNutritionOptions } from '@/components/NutrientPicker'
import { stageDaysForWeek, weekInStage } from '@/app/lib/nutrition'
import type { MixItem } from '@/app/lib/nutrition'
import { feedContext } from '@/app/lib/task-targets'
import type { CycleOption, PlantOption } from '@/app/lib/task-targets'

type Plant = PlantOption
type TargetType = 'plant' | 'space' | 'cycle'
type Target = { id: string | number; name: string; type: TargetType }
interface Space { id: number; name: string; }

interface AddTaskModalProps {
  isOpen: boolean
  onClose: () => void
  plants: Plant[]
  spaces: Space[]
  cycles?: CycleOption[]
  /** Día con el que abre el formulario ("YYYY-MM-DD"); si no, hoy en Argentina. */
  initialDay?: string
}

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Todos los días' },
  { value: 'every2days', label: 'Cada 2 días' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Cada 15 días' },
  { value: 'monthly', label: 'Mensual' },
]

const TARGET_TABS: { type: TargetType; label: string; icon: React.ReactNode }[] = [
  { type: 'cycle', label: 'Ciclos', icon: <Layers size={15} /> },
  { type: 'space', label: 'Espacios', icon: <Warehouse size={15} /> },
  { type: 'plant', label: 'Plantas', icon: <Sprout size={15} /> },
]

/** Con más opciones que esto, la lista de objetivos suma un buscador. */
const SEARCH_THRESHOLD = 10

const TYPE_OPTIONS = taskTypeOptions()
const STAGE_OPTIONS = stageOptions(STAGE_NAMES)

export default function AddTaskModal({ isOpen, onClose, plants, spaces, cycles = [], initialDay }: AddTaskModalProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const formRef = useRef<HTMLFormElement>(null)
  const { errors, validate, clear } = useFieldErrors<'type' | 'targets' | 'other' | 'space' | 'endDate'>()

  const [selectedTargets, setSelectedTargets] = useState<Target[]>([])
  const [taskTypeId, setTaskTypeId] = useState<string | null>(null)
  const selectedTaskType = TASK_TYPES.find(t => t.id === taskTypeId) ?? null
  // Si cambia el día elegido en la agenda, quien lo abre cambia la `key` y el
  // formulario arranca de cero con el día nuevo.
  const [date, setDate] = useState(() => initialDay ?? todayKey())

  const [description, setDescription] = useState('')
  const [otherText, setOtherText] = useState('')
  const [applicationType, setApplicationType] = useState('Riego')
  const [targetStage, setTargetStage] = useState('Vegetativo')
  const [targetSpaceId, setTargetSpaceId] = useState<number | ''>('')

  // Pestaña de objetivos: arranca en la que tiene algo para elegir.
  const [targetTab, setTargetTab] = useState<TargetType>(() =>
    cycles.length > 0 ? 'cycle' : plants.length > 0 ? 'plant' : 'space'
  )
  const [targetQuery, setTargetQuery] = useState('')

  // Nutrición: la mezcla (productos con su dosis) y la semana, si se cambia a mano.
  const nutrition = useNutritionOptions()
  const [mix, setMix] = useState<MixItem[]>([])
  const [weekOverride, setWeekOverride] = useState<number | null>(null)

  // Recurrencia
  const [isRecurring, setIsRecurring] = useState(false)
  const [frequency, setFrequency] = useState<Frequency>('daily')
  const [endDate, setEndDate] = useState(() => addDaysToKey(initialDay ?? todayKey(), 30))

  const [isSubmitting, setIsSubmitting] = useState(false)

  const changeTaskType = (id: string | null) => {
    setTaskTypeId(id)
    clear('type')
    // Los productos se piden la primera vez que se elige "Fertilizante".
    if (id === 'fertilizante') nutrition.load()
    else setMix([])
    // El esquejado se apunta al ciclo entero: se lleva a esa pestaña.
    if (id === 'esquejado' && cycles.length > 0) setTargetTab('cycle')
  }

  /**
   * La semana de la etapa para la dosis: la de lo elegido el día de la tarea.
   * Si los objetivos están en semanas distintas se usa la más temprana (y se
   * avisa); también se puede cambiar a mano. En una serie, el servidor avanza
   * la semana en cada repetición.
   */
  const context = feedContext(selectedTargets, plants, cycles)
  const autoStageDays = context.stageDays === null
    ? 0
    : Math.max(0, context.stageDays + daysBetweenKeys(todayKey(), date))
  const week = weekOverride ?? weekInStage(autoStageDays)
  const stageDays = weekOverride !== null ? stageDaysForWeek(weekOverride) : autoStageDays
  const weekNote = weekOverride !== null ? (
    <>
      Semana elegida a mano.{' '}
      <button type="button" className="font-semibold text-[color:var(--brand-text)]" onClick={() => setWeekOverride(null)}>
        Volver a la de las plantas ({weekInStage(autoStageDays)})
      </button>
    </>
  ) : selectedTargets.length === 0 ? (
    'Elegí sobre qué es la tarea y la semana se calcula sola.'
  ) : context.minWeek !== null && context.maxWeek !== null && context.minWeek !== context.maxWeek ? (
    `Lo elegido va de la semana ${context.minWeek} a la ${context.maxWeek} de su etapa: se usa la ${context.minWeek} para no pasarse.`
  ) : isRecurring ? (
    'En la serie, cada repetición usa la dosis de su semana.'
  ) : undefined

  const toggleTarget = (item: Target) => {
    const exists = selectedTargets.some(t => t.id === item.id && t.type === item.type)
    const next = exists
      ? selectedTargets.filter(t => !(t.id === item.id && t.type === item.type))
      : [...selectedTargets, item]
    setSelectedTargets(next)
    clear('targets')
  }

  const groups: Record<TargetType, { id: string | number; name: string }[]> = {
    cycle: cycles,
    space: spaces,
    plant: plants,
  }
  const tabs = TARGET_TABS.filter(tab => groups[tab.type].length > 0)
  const activeItems = groups[targetTab] ?? []
  const q = targetQuery.trim().toLowerCase()
  const visibleItems = q ? activeItems.filter(item => item.name.toLowerCase().includes(q)) : activeItems
  const countByType = (type: TargetType) => selectedTargets.filter(t => t.type === type).length

  // Vista previa de la serie: cuántas tareas y cuándo cae la última.
  const series = useMemo(
    () => (isRecurring ? buildOccurrenceDates(date, endDate, frequency) : null),
    [isRecurring, date, endDate, frequency]
  )
  const taskCount = series ? series.dates.length : 1

  const targetAlreadyThere =
    targetSpaceId !== '' &&
    selectedTargets.some(t => {
      if (t.type === 'plant') return plants.find(p => p.id === t.id)?.space_id === Number(targetSpaceId)
      if (t.type === 'cycle') return cycles.find(c => c.id === t.id)?.space_id === Number(targetSpaceId)
      return false
    })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const ok = validate({
      type: !selectedTaskType && 'Elegí qué tarea es.',
      targets: selectedTargets.length === 0 && 'Elegí al menos un ciclo, espacio o planta.',
      other: selectedTaskType?.id === 'otro' && !otherText.trim() && 'Escribí el nombre de la tarea.',
      space: selectedTaskType?.id === 'ambiente' && targetSpaceId === '' && 'Elegí a qué espacio se muda.',
      endDate: isRecurring && !endDate && 'Elegí hasta cuándo se repite.',
    }, formRef.current)
    if (!ok || !selectedTaskType) return

    setIsSubmitting(true)

    const result = await createTask({
      targets: selectedTargets,
      // La mezcla viaja como datos; el servidor arma la receta de cada fecha
      // (en una serie, la semana avanza entre una repetición y la siguiente).
      nutrition: selectedTaskType.id === 'fertilizante' && mix.length > 0 ? { items: mix, stage_days: stageDays } : null,
      taskType: { id: selectedTaskType.id, label: selectedTaskType.label },
      applicationType,
      targetStage,
      // Antes el destino no viajaba y "Cambiar ambiente" siempre volvía con
      // "Elegí el espacio de destino", aunque estuviera elegido.
      targetSpaceId: selectedTaskType.id === 'ambiente' ? targetSpaceId : null,
      date: `${date}T12:00:00`, // Mediodía para evitar desfases de zona horaria
      description,
      otherText,
      isRecurring,
      frequency,
      endDate: isRecurring ? `${endDate}T12:00:00` : null
    })

    setIsSubmitting(false)

    if (result?.error) {
      showToast(result.error, 'error')
    } else {
      const created = result && 'created' in result ? result.created ?? 1 : 1
      showToast(
        result && 'truncated' in result && result.truncated
          ? `Se agendaron ${created} repeticiones: es el máximo para una serie.`
          : created > 1 ? `${created} tareas agendadas` : 'Tarea agendada',
        'success'
      )
      router.refresh()

      setSelectedTargets([])
      changeTaskType(null)
      setWeekOverride(null)
      setDescription('')
      setOtherText('')
      setIsRecurring(false)
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva tarea"
      description="Qué hay que hacer, sobre qué y cuándo."
      dismissOnBackdrop={false}
      footer={
        <FormActions
          form="add-task-form"
          onCancel={onClose}
          icon={CalendarPlus}
          pending={isSubmitting}
          pendingLabel="Agendando…"
          submitLabel={taskCount > 1 ? `Agendar ${taskCount} tareas` : 'Agendar tarea'}
        />
      }
    >
      <form id="add-task-form" ref={formRef} onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* 1. QUÉ */}
        <ChoiceGroup
          legend="¿Qué hay que hacer?"
          variant="compact"
          options={TYPE_OPTIONS}
          value={taskTypeId}
          onChange={changeTaskType}
          error={errors.type}
          // 12 tipos en una grilla de 4×3; "Otro" cierra abajo a lo ancho.
          layout="grid grid-cols-4 gap-2 [&>label:last-child]:col-span-4 [&>label:last-child]:min-h-[2.75rem] [&>label:last-child]:flex-row"
        />

        {selectedTaskType?.id === 'otro' && (
          <div className="form-reveal">
            <Field label="Nombre de la tarea" error={errors.other}>
              <Input
                type="text"
                placeholder="Ej: Revisar tricomas"
                value={otherText}
                onChange={(e) => { setOtherText(e.target.value); clear('other') }}
                autoComplete="off"
              />
            </Field>
          </div>
        )}

        {selectedTaskType?.id === 'esquejado' && (
          <FormAlert tone="info">
            <span className="flex items-start gap-2">
              <GitBranch size={15} className="mt-0.5 shrink-0 text-[color:var(--brand-text)]" aria-hidden="true" />
              Apuntala al ciclo entero. Al completarla vas a elegir de qué plantas sacaste
              esquejes y cuántos, y se crean como plantas nuevas en Enraizamiento.
            </span>
          </FormAlert>
        )}

        {selectedTaskType?.id === 'fertilizante' && (
          <div className="form-reveal space-y-5">
            <NutrientPicker
              options={nutrition.options}
              state={nutrition.state}
              onReload={nutrition.reload}
              value={mix}
              onChange={setMix}
              week={week}
              onWeekChange={setWeekOverride}
              weekNote={weekNote}
              stages={context.stages}
              hint="Combos, productos o los dos. La dosis sale de la semana de la etapa y la podés ajustar."
              showRecipe
            />

            <ChoiceGroup
              legend="Cómo se aplica"
              options={APPLICATION_OPTIONS}
              value={applicationType}
              onChange={setApplicationType}
              size="sm"
            />
          </div>
        )}

        {selectedTaskType?.id === 'cambio_etapa' && (
          <div className="form-reveal">
            <ChoiceGroup
              legend="Pasa a"
              options={STAGE_OPTIONS}
              value={targetStage}
              onChange={setTargetStage}
              size="sm"
            />
          </div>
        )}

        {selectedTaskType?.id === 'ambiente' && (
          <div className="form-reveal">
            <ChoiceGroup
              legend="Se muda a"
              options={spaces.map(space => ({ value: space.id, label: space.name, icon: <Warehouse size={15} /> }))}
              value={targetSpaceId === '' ? null : targetSpaceId}
              onChange={(id) => { setTargetSpaceId(id); clear('space') }}
              error={errors.space}
              size="sm"
            />
            {targetAlreadyThere && !errors.space && (
              <FormAlert tone="warning" className="mt-3">El objetivo ya está en este espacio.</FormAlert>
            )}
          </div>
        )}

        {/* 2. SOBRE QUÉ */}
        <FieldGroup
          legend="¿Sobre qué?"
          error={errors.targets}
          aside={
            selectedTargets.length > 0 ? (
              <button
                type="button"
                className="text-[0.8125rem] font-semibold text-[color:var(--brand-text)] hover:underline"
                onClick={() => setSelectedTargets([])}
              >
                Quitar todo
              </button>
            ) : undefined
          }
        >
          {tabs.length === 0 ? (
            <p className="text-sm text-fg-muted">Todavía no hay ciclos, espacios ni plantas para elegir.</p>
          ) : (
            <div className="space-y-3">
              {tabs.length > 1 && (
                <div role="tablist" aria-label="Tipo de objetivo" className="segmented segmented-block">
                  {tabs.map(tab => {
                    const count = countByType(tab.type)
                    return (
                      <button
                        key={tab.type}
                        type="button"
                        role="tab"
                        aria-selected={targetTab === tab.type}
                        onClick={() => { setTargetTab(tab.type); setTargetQuery('') }}
                        className="segmented-item"
                      >
                        <span aria-hidden="true" className="hidden sm:inline-flex">{tab.icon}</span>
                        {tab.label}
                        {count > 0 && (
                          <span className="mono rounded-full bg-brand px-1.5 text-[0.6875rem] leading-[1.125rem] text-[color:var(--brand-fg)]">
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {activeItems.length > SEARCH_THRESHOLD && (
                <Input
                  type="search"
                  leading={<Search size={17} />}
                  placeholder={`Buscar ${TARGET_TABS.find(t => t.type === targetTab)?.label.toLowerCase()}`}
                  aria-label="Buscar objetivos"
                  value={targetQuery}
                  onChange={(e) => setTargetQuery(e.target.value)}
                />
              )}

              <MultiChoice
                legend={TARGET_TABS.find(t => t.type === targetTab)?.label ?? ''}
                hideLegend
                size="sm"
                layout="custom-scrollbar flex max-h-52 flex-wrap content-start gap-2 overflow-y-auto p-0.5"
                options={visibleItems.map(item => ({ value: String(item.id), label: item.name }))}
                values={selectedTargets.filter(t => t.type === targetTab).map(t => String(t.id))}
                onToggle={(id) => {
                  const item = activeItems.find(i => String(i.id) === id)
                  if (item) toggleTarget({ id: item.id, name: item.name, type: targetTab })
                }}
              />
              {visibleItems.length === 0 && (
                <p className="text-sm text-fg-muted">Nada coincide con “{targetQuery}”.</p>
              )}

              {/* Lo elegido en otras pestañas sigue a la vista y se puede quitar. */}
              {selectedTargets.some(t => t.type !== targetTab) && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Otros objetivos elegidos">
                  {selectedTargets.filter(t => t.type !== targetTab).map(target => (
                    <li key={`${target.type}-${target.id}`}>
                      <span className="chip chip-brand py-1 pl-2.5 text-xs">
                        {target.name}
                        <button
                          type="button"
                          onClick={() => toggleTarget(target)}
                          className="-mr-1 rounded-full p-0.5 hover:bg-[color:var(--brand-soft-strong)]"
                          aria-label={`Quitar ${target.name}`}
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </FieldGroup>

        {/* 3. CUÁNDO */}
        <FormSection title="Cuándo">
          <DateField label="Día" value={date} onChange={setDate} quick="future" />

          <div className="rounded-[var(--radius-lg)] border border-line px-4 py-1">
            <Switch
              checked={isRecurring}
              onChange={setIsRecurring}
              icon={<Repeat size={17} />}
              label="Repetir"
              description={isRecurring ? undefined : 'Para riegos o controles que vuelven cada tantos días.'}
            />

            {isRecurring && (
              <div className="space-y-5 border-t border-line pb-4 pt-4 animate-fade-in">
                <ChoiceGroup
                  legend="Cada cuánto"
                  options={FREQUENCY_OPTIONS}
                  value={frequency}
                  onChange={setFrequency}
                  size="sm"
                />
                <DateField
                  label="Hasta"
                  value={endDate}
                  onChange={(v) => { setEndDate(v); clear('endDate') }}
                  min={date}
                  error={errors.endDate}
                  quick={[
                    { label: '2 semanas', value: addDaysToKey(date, 14) },
                    { label: '1 mes', value: addDaysToKey(date, 30) },
                    { label: '2 meses', value: addDaysToKey(date, 60) },
                  ]}
                />
                {series && series.dates.length > 0 && (
                  <p className="rounded-[var(--radius-md)] bg-brand-soft px-3 py-2 text-sm text-fg" role="status">
                    Se agendan <strong className="mono">{series.dates.length}</strong>{' '}
                    {series.dates.length === 1 ? 'tarea' : 'tareas'}, la última el{' '}
                    <strong>{formatInAppTz(series.dates[series.dates.length - 1], { weekday: 'short', day: 'numeric', month: 'short' })}</strong>.
                    {series.truncated && ' Es el máximo para una serie.'}
                  </p>
                )}
              </div>
            )}
          </div>
        </FormSection>

        {/* 4. DETALLES */}
        <Field label={selectedTaskType?.id === 'fertilizante' ? 'Notas' : 'Detalles'} optional>
          <Textarea
            placeholder={selectedTaskType?.id === 'fertilizante' ? 'Cómo prepararla, en qué orden, lo que haga falta recordar' : 'Dosis, observaciones, lo que haga falta recordar'}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  )
}
