'use client'

import { useMemo, useRef, useState } from 'react'
import { CalendarPlus, GitBranch, Layers, Repeat, Search, Sprout, Warehouse, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createTask } from '@/app/actions/tasks'
import { useToast } from '@/app/context/ToastContext'
import { addDaysToKey, formatInAppTz, todayKey } from '@/app/lib/dates'
import { TASK_TYPES } from '@/app/lib/constants'
import { STAGE_NAMES } from '@/app/lib/stage-logic'
import { buildOccurrenceDates, type Frequency } from '@/app/lib/recurrence'
import Modal from '@/components/ui/Modal'
import {
  APPLICATION_OPTIONS, ChoiceGroup, DateField, Field, FieldGroup, FormActions, FormAlert, FormSection,
  Input, MultiChoice, Select, Switch, Textarea, stageOptions, taskTypeOptions, useFieldErrors,
} from '@/components/ui/form'

// Interfaces
import { Fertilizer, FertilizerCombo } from '@/app/lib/types'
import { getFertilizers, getFertilizerCombos } from '@/app/actions/fertilizers'
import { averageDays, buildRecipe, recipeItems, weekInStage, withRecipe } from '@/app/lib/nutrition'

interface Plant { id: string; name: string; days_in_stage?: number | null; space_id?: number; cycle_id?: number | null; }
interface CycleOption { id: number; name: string; space_id?: number | null; days_in_stage?: number | null }
type TargetType = 'plant' | 'space' | 'cycle'
type Target = { id: string | number; name: string; type: TargetType }

/** Días en la etapa de un objetivo: los de la planta, o el promedio del ciclo o del espacio. */
function targetDaysInStage(
  target: { id: string | number; type: TargetType },
  plants: Plant[],
  cycles: CycleOption[]
): number | null {
  if (target.type === 'plant') return plants.find(p => String(p.id) === String(target.id))?.days_in_stage ?? null
  if (target.type === 'cycle') return cycles.find(c => c.id === Number(target.id))?.days_in_stage ?? null
  return averageDays(cycles.filter(c => c.space_id === Number(target.id)).map(c => c.days_in_stage))
}
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

  // Nutrición (Fertilizantes)
  const [fertilizers, setFertilizers] = useState<Fertilizer[]>([])
  const [combos, setCombos] = useState<FertilizerCombo[]>([])
  const [selectedNutrition, setSelectedNutrition] = useState<{ type: 'product' | 'combo', id: number } | null>(null)
  const [isNutritionLoading, setIsNutritionLoading] = useState(false)

  // Recurrencia
  const [isRecurring, setIsRecurring] = useState(false)
  const [frequency, setFrequency] = useState<Frequency>('daily')
  const [endDate, setEndDate] = useState(() => addDaysToKey(initialDay ?? todayKey(), 30))

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Los productos y combos se piden la primera vez que se elige
  // "Fertilizante", en el momento del cambio (antes, un efecto que miraba el
  // tipo los volvía a pedir cada vez).
  const nutritionLoaded = useRef(false)

  const loadNutrition = async () => {
    if (nutritionLoaded.current) return
    nutritionLoaded.current = true
    setIsNutritionLoading(true)
    try {
      const [fertRes, combosRes] = await Promise.all([getFertilizers(), getFertilizerCombos()])
      if (fertRes.data) setFertilizers(fertRes.data)
      if (combosRes.data) setCombos(combosRes.data)
    } catch (error) {
      nutritionLoaded.current = false
      console.error("Failed to load nutrition data", error)
    } finally {
      setIsNutritionLoading(false)
    }
  }

  const changeTaskType = (id: string | null) => {
    setTaskTypeId(id)
    clear('type')
    if (id === 'fertilizante') loadNutrition()
    else setSelectedNutrition(null)
    // El esquejado se apunta al ciclo entero: se lleva a esa pestaña.
    if (id === 'esquejado' && cycles.length > 0) setTargetTab('cycle')
  }

  /**
   * Escribe la receta en los detalles con la semana de la etapa del primer
   * objetivo: una planta tiene sus días en la etapa y un ciclo o un espacio,
   * el promedio de sus plantas. Antes la semana era siempre la 1, porque la
   * lista de plantas no traía los días en etapa y los ciclos no se miraban.
   *
   * Se llama al elegir producto u objetivo, no desde un efecto: así la receta
   * se recalcula sólo cuando cambia algo que la afecta. En una serie, el
   * servidor recalcula la semana de cada fecha.
   */
  const applyRecipe = (
    nutrition: { type: 'product' | 'combo'; id: number } | null,
    targets: { id: string | number; type: TargetType }[]
  ) => {
    if (!nutrition || targets.length === 0) return
    const week = weekInStage(targetDaysInStage(targets[0], plants, cycles))
    const recipe = buildRecipe(recipeItems(nutrition, fertilizers, combos, week), week)
    setDescription(prev => withRecipe(prev, recipe))
  }

  const toggleTarget = (item: Target) => {
    const exists = selectedTargets.some(t => t.id === item.id && t.type === item.type)
    const next = exists
      ? selectedTargets.filter(t => !(t.id === item.id && t.type === item.type))
      : [...selectedTargets, item]
    setSelectedTargets(next)
    clear('targets')
    applyRecipe(selectedNutrition, next)
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
      // El servidor recalcula la receta para cada fecha de la serie: la
      // semana de la etapa avanza entre una repetición y la siguiente.
      nutrition: selectedTaskType.id === 'fertilizante' ? selectedNutrition : null,
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
      setDescription('')
      setOtherText('')
      setIsRecurring(false)
      onClose()
    }
  }

  const nutritionValue = selectedNutrition ? `${selectedNutrition.type}-${selectedNutrition.id}` : ''

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
            <Field
              label="Combo o producto"
              optional
              hint="Calcula la receta para la semana de la etapa y la suma a los detalles."
            >
              <Select
                value={nutritionValue}
                onChange={(e) => {
                  const val = e.target.value
                  if (!val) {
                    setSelectedNutrition(null)
                  } else {
                    const [type, id] = val.split('-')
                    const next = { type: type as 'product' | 'combo', id: parseInt(id) }
                    setSelectedNutrition(next)
                    applyRecipe(next, selectedTargets)
                  }
                }}
                aria-busy={isNutritionLoading}
              >
                <option value="">{isNutritionLoading ? 'Cargando productos…' : 'Sin receta'}</option>
                {combos.length > 0 && <optgroup label="Combos">
                  {combos.map(c => <option key={`combo-${c.id}`} value={`combo-${c.id}`}>{c.name}</option>)}
                </optgroup>}
                {fertilizers.length > 0 && <optgroup label="Productos">
                  {fertilizers.map(f => <option key={`product-${f.id}`} value={`product-${f.id}`}>{f.name}</option>)}
                </optgroup>}
              </Select>
            </Field>

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
        <Field label="Detalles" optional>
          <Textarea
            placeholder="Dosis, observaciones, lo que haga falta recordar"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  )
}
