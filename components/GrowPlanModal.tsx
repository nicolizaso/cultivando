'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarRange, Plus, Trash2, X } from 'lucide-react'
import { createGrowPlan, deleteGrowPlan } from '@/app/actions/grow-plan'
import { CUSTOM_PLAN_TYPES, MAX_CUSTOM_NOTE, MAX_CUSTOM_TASKS, buildGrowPlan, countByType, isCustomPlanType } from '@/app/lib/grow-plan'
import type { CustomPlanTask, PlanItem } from '@/app/lib/grow-plan'
import { MAX_FLOWER_WEEKS, MIN_FLOWER_WEEKS, STAGE_SHORT } from '@/app/lib/cycle-week'
import { mixLabel } from '@/app/lib/nutrition'
import type { MixItem } from '@/app/lib/nutrition'
import NutrientPicker, { useNutritionOptions } from '@/components/NutrientPicker'
import type { StageName } from '@/app/lib/stage-logic'
import { addDaysToKey, formatInAppTz, todayKey } from '@/app/lib/dates'
import { getTaskType } from '@/app/lib/constants'
import { useToast } from '@/app/context/ToastContext'
import Modal from '@/components/ui/Modal'
import { ChoiceGroup, Disclosure, Field, FormActions, FormAlert, FormSection, Input, MultiChoice, Select, Stepper } from '@/components/ui/form'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface GrowPlanModalProps {
  cycleId: number
  /** Etapa del ciclo y desde cuándo, como lo calcula la página. */
  stage: StageName | null
  stageStart: string | null
  /** Sugerencias: los promedios de la genética o los valores de siempre. */
  defaultVegDays: number
  /** La meta de flora del ciclo, en semanas. */
  defaultFlowerWeeks: number
  /** Tareas pendientes de planes anteriores de este ciclo. */
  pendingPlanTasks: number
}

/** Cómo se llama una tarea propia en los avisos. */
function customName(task: CustomPlanTask): string {
  return task.type === 'otro' && task.note?.trim() ? task.note.trim() : getTaskType(task.type).label
}

/**
 * Arma el calendario del ciclo de una vez. Se ve antes de crear: cada tarea
 * se puede destildar, y lo que se crea son tareas comunes de la agenda
 * (marcadas como parte del plan, para poder borrarlas juntas).
 */
export default function GrowPlanModal(props: GrowPlanModalProps) {
  const { cycleId, stage, stageStart, defaultVegDays, defaultFlowerWeeks, pendingPlanTasks } = props
  const router = useRouter()
  const { showToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const [vegDays, setVegDays] = useState(String(defaultVegDays))
  const [flowerWeeks, setFlowerWeeks] = useState(String(defaultFlowerWeeks))
  const [waterEvery, setWaterEvery] = useState('3')
  const [feedEvery, setFeedEvery] = useState('2')
  const [flushDays, setFlushDays] = useState('10')
  const [vegNutrition, setVegNutrition] = useState<MixItem[]>([])
  const [flowerNutrition, setFlowerNutrition] = useState<MixItem[]>([])
  const [include, setInclude] = useState({ stageChange: true, harvest: true, flush: true })
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  // Tareas propias por semana de etapa (podas, entrenamiento…).
  const [custom, setCustom] = useState<CustomPlanTask[]>([])
  const [nextCustomId, setNextCustomId] = useState(1)

  const nutrition = useNutritionOptions()
  const [openMix, setOpenMix] = useState<'veg' | 'flower' | null>(null)

  const open = () => {
    setIsOpen(true)
    nutrition.load()
  }

  const options = useMemo(() => ({
    vegDays: Number(vegDays) || defaultVegDays,
    flowerWeeks: Number(flowerWeeks) || defaultFlowerWeeks,
    flowerDays: (Number(flowerWeeks) || defaultFlowerWeeks) * 7,
    waterEvery: Number(waterEvery) || 3,
    feedEvery: Number(feedEvery),
    flushDays: Number(flushDays) || 0,
    vegNutrition: vegNutrition.length > 0 ? vegNutrition : null,
    flowerNutrition: flowerNutrition.length > 0 ? flowerNutrition : null,
    include,
    custom,
  }), [vegDays, flowerWeeks, waterEvery, feedEvery, flushDays, vegNutrition, flowerNutrition, include, custom, defaultVegDays, defaultFlowerWeeks])

  const plan = useMemo(
    () => (stage && stageStart ? buildGrowPlan({ ...options, today: todayKey(), currentStage: stage, stageStart }) : null),
    [options, stage, stageStart]
  )

  const selected = (plan?.items ?? []).filter((item) => !excluded.has(item.key))
  const counts = countByType(selected)

  // La vista previa agrupada por semana de calendario.
  const weeks = useMemo(() => {
    const groups = new Map<string, PlanItem[]>()
    for (const item of plan?.items ?? []) {
      // El lunes de esa semana, contado sobre el día de calendario (sin husos).
      const [y, m, d] = item.day.split('-').map(Number)
      const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
      const key = addDaysToKey(item.day, -((weekday + 6) % 7))
      groups.set(key, [...(groups.get(key) ?? []), item])
    }
    return Array.from(groups)
  }, [plan])

  const addCustom = () => {
    const id = `t${nextCustomId}`
    setNextCustomId((n) => n + 1)
    setCustom((prev) => [...prev, { id, type: 'poda', stage: stage === 'Floración' ? 'Floración' : 'Vegetativo', week: 1, day: 1, note: '' }])
  }
  const updateCustom = (id: string, patch: Partial<CustomPlanTask>) =>
    setCustom((prev) => prev.map((task) => (task.id === id ? { ...task, ...patch } : task)))
  const removeCustom = (id: string) => setCustom((prev) => prev.filter((task) => task.id !== id))
  const missingOtherName = custom.some((task) => task.type === 'otro' && !task.note?.trim())

  const toggle = (key: string) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const save = async () => {
    setSaving(true)
    const res = await createGrowPlan(cycleId, options, Array.from(excluded))
    setSaving(false)
    if (res.error) {
      showToast(res.error, 'error')
      return
    }
    showToast(`Plan creado: ${res.created} tareas en la agenda${res.truncated ? ' (se cortó en el máximo)' : ''}.`)
    setIsOpen(false)
    setExcluded(new Set())
    setCustom([])
    router.refresh()
  }

  const removePlan = async () => {
    const res = await deleteGrowPlan(cycleId)
    if (res.error) {
      showToast(res.error, 'error')
      return
    }
    showToast(`Se borraron ${res.deleted} tareas pendientes del plan.`)
    router.refresh()
  }

  const stepper = (label: string, value: string, set: (v: string) => void, opts: { min?: number; max?: number; suffix: string; hint?: string }) => (
    <Field label={label} hint={opts.hint}>
      <Stepper
        value={Number(value) || 0}
        onChange={(n) => set(String(n))}
        min={opts.min ?? 0}
        max={opts.max ?? 200}
        suffix={opts.suffix}
      />
    </Field>
  )

  const mixSection = (key: 'veg' | 'flower', label: string, stageName: string, value: MixItem[], set: (items: MixItem[]) => void) => (
    <Disclosure
      label={label}
      summary={value.length > 0 ? mixLabel(value, nutrition.options?.combos ?? []) : 'Sin fertilizante'}
      open={openMix === key}
      onOpenChange={(isOpenNow) => setOpenMix(isOpenNow ? key : null)}
    >
      <NutrientPicker
        options={nutrition.options}
        state={nutrition.state}
        onReload={nutrition.reload}
        value={value}
        onChange={set}
        week={1}
        hideWeek
        stages={[stageName]}
        legend="Qué lleva"
        hint="Cada riego con fertilizante usa la dosis de su semana. Lo que ajustes a mano queda igual en todas."
      />
    </Disclosure>
  )

  const includeKeys = (Object.keys(include) as (keyof typeof include)[]).filter((key) => include[key])

  return (
    <>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-sm btn-secondary" onClick={open}>
          <CalendarRange size={15} aria-hidden="true" />
          Plan de cultivo
        </button>
        {pendingPlanTasks > 0 && (
          <button
            type="button"
            className="btn-icon btn-icon-sm text-[color:var(--danger)]"
            onClick={() => setConfirmDelete(true)}
            aria-label={`Borrar el plan (${pendingPlanTasks} tareas pendientes)`}
            title={`Borrar el plan (${pendingPlanTasks} tareas pendientes)`}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={removePlan}
        title="Borrar el plan"
        description={`Se borran las ${pendingPlanTasks} tareas pendientes del plan de este ciclo. Las que ya hiciste quedan.`}
        confirmLabel="Borrar plan"
      />

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Plan de cultivo"
        description={stage ? `El ciclo está en ${stage.toLowerCase()}${stageStart ? ` desde el ${formatInAppTz(stageStart, { day: 'numeric', month: 'short' })}` : ''}.` : undefined}
        size="xl"
        footer={
          <FormActions
            onSubmit={save}
            onCancel={() => setIsOpen(false)}
            icon={CalendarRange}
            pending={saving}
            pendingLabel="Creando…"
            disabled={selected.length === 0 || missingOtherName}
            submitLabel={`Agendar ${selected.length} ${selected.length === 1 ? 'tarea' : 'tareas'}`}
          />
        }
      >
        {!plan ? (
          <p className="py-6 text-center text-sm text-fg-muted">
            {stage === 'Secado' || stage === 'Curado'
              ? 'El ciclo ya está cosechado: no hay plan que armar.'
              : 'Cargá la etapa de las plantas (con su fecha) para armar el plan.'}
          </p>
        ) : (
          <div className="space-y-6">
            {pendingPlanTasks > 0 && (
              <FormAlert tone="warning">
                Este ciclo ya tiene {pendingPlanTasks} tareas pendientes de un plan. Si armás otro, conviene borrar el anterior primero.
              </FormAlert>
            )}

            <FormSection title="Duración">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {stage !== 'Floración' && stepper('Vegetativo', vegDays, setVegDays, { suffix: 'días', min: 1, hint: 'Desde que empezó la etapa' })}
                {stepper('Floración', flowerWeeks, setFlowerWeeks, { suffix: 'semanas', min: MIN_FLOWER_WEEKS, max: MAX_FLOWER_WEEKS, hint: 'Queda como meta del ciclo' })}
              </div>
            </FormSection>

            <FormSection title="Riego y nutrición">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {stepper('Regar cada', waterEvery, setWaterEvery, { suffix: 'días', min: 1, max: 30 })}
                {stepper('Fertilizar 1 de cada', feedEvery, setFeedEvery, { suffix: 'riegos', max: 10, hint: '0 = nunca' })}
              </div>
              <div className="space-y-3">
                {stage !== 'Floración' && mixSection('veg', 'Fertilizante en vegetativo', 'Vegetativo', vegNutrition, setVegNutrition)}
                {mixSection('flower', 'Fertilizante en floración', 'Floración', flowerNutrition, setFlowerNutrition)}
              </div>
            </FormSection>

            <FormSection title="Además">
              <MultiChoice
                legend="Qué más incluir"
                hideLegend
                size="sm"
                options={[
                  { value: 'stageChange', label: 'Cambios de etapa' },
                  { value: 'flush', label: 'Lavado de raíces' },
                  { value: 'harvest', label: 'Cosecha' },
                ]}
                values={includeKeys}
                onToggle={(key) => setInclude((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
              />
              {include.flush && stepper('Lavado', flushDays, setFlushDays, { suffix: 'días antes', max: 30, hint: 'Con agua sola, antes de cortar.' })}
            </FormSection>

            <FormSection
              title="Tus tareas"
              description="Podas, entrenamiento, defoliación… las que ya sabés, por semana de etapa. Se agendan con el resto."
            >
              {custom.length > 0 && (
                <ul className="space-y-3">
                  {custom.map((task, index) => (
                    <li key={task.id} className="space-y-3 rounded-[var(--radius-lg)] border border-line p-3">
                      <div className="flex items-start gap-2">
                        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                          <Field label="Tarea">
                            <Select
                              value={task.type}
                              onChange={(e) => { if (isCustomPlanType(e.target.value)) updateCustom(task.id, { type: e.target.value }) }}
                              aria-label={`Tipo de la tarea ${index + 1}`}
                            >
                              {CUSTOM_PLAN_TYPES.map((type) => (
                                <option key={type} value={type}>{getTaskType(type).label}</option>
                              ))}
                            </Select>
                          </Field>
                          <Field label={task.type === 'otro' ? 'Qué es' : 'Nota'} optional={task.type !== 'otro'}>
                            <Input
                              type="text"
                              value={task.note ?? ''}
                              maxLength={MAX_CUSTOM_NOTE}
                              placeholder={task.type === 'otro' ? 'Ej: Defoliación' : 'Ej: Apical'}
                              onChange={(e) => updateCustom(task.id, { note: e.target.value })}
                              autoComplete="off"
                            />
                          </Field>
                        </div>
                        <button
                          type="button"
                          className="btn-icon btn-icon-sm mt-7"
                          onClick={() => removeCustom(task.id)}
                          aria-label={`Quitar la tarea ${index + 1}`}
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <ChoiceGroup
                          legend="Etapa"
                          size="sm"
                          options={[
                            { value: 'Vegetativo' as const, label: 'Vege', disabled: stage === 'Floración' },
                            { value: 'Floración' as const, label: 'Flora' },
                          ]}
                          value={task.stage}
                          onChange={(value) => updateCustom(task.id, { stage: value })}
                        />
                        <Field label="Semana">
                          <Stepper value={task.week} onChange={(week) => updateCustom(task.id, { week })} min={1} max={30} unitName="semana" />
                        </Field>
                        <Field label="Día de la semana">
                          <Stepper value={task.day} onChange={(day) => updateCustom(task.id, { day })} min={1} max={7} unitName="día" />
                        </Field>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {custom.length < MAX_CUSTOM_TASKS && (
                <button type="button" className="btn btn-sm btn-secondary" onClick={addCustom}>
                  <Plus size={15} aria-hidden="true" />
                  Agregar tarea
                </button>
              )}
              {plan.skipped.length > 0 && (
                <FormAlert tone="warning">
                  No se agendan:{' '}
                  {plan.skipped.map(({ task, reason }, i) => (
                    <span key={task.id}>
                      {i > 0 && '; '}
                      {customName(task)} ({STAGE_SHORT[task.stage]}{task.week}) {reason === 'past' ? 'ya pasó' : 'cae después de la cosecha'}
                    </span>
                  ))}.
                </FormAlert>
              )}
            </FormSection>

            <div className="rounded-[var(--radius-lg)] bg-brand-soft p-4 text-sm">
              <p className="text-fg">
                Floración desde el <strong>{formatInAppTz(plan.flowerStart, { day: 'numeric', month: 'short' })}</strong>, cosecha el{' '}
                <strong>{formatInAppTz(plan.harvestDay, { day: 'numeric', month: 'short', year: 'numeric' })}</strong>.
              </p>
              <p className="mt-1 text-fg-muted">
                {counts.riego + counts.fertilizante} riegos ({counts.fertilizante} con fertilizante)
                {counts.cambio_etapa > 0 && `, ${counts.cambio_etapa} ${counts.cambio_etapa === 1 ? 'cambio' : 'cambios'} de etapa`}
                {counts.propias > 0 && `, ${counts.propias} ${counts.propias === 1 ? 'tarea tuya' : 'tareas tuyas'}`}
                {counts.lavado > 0 && ', lavado'}{counts.cosechar > 0 && ' y cosecha'}
                {plan.truncated && '. Se cortó en 200 tareas'}.
              </p>
            </div>

            <p className="field-label">Revisá las fechas <span className="field-optional">destildá lo que no quieras</span></p>
            <ol className="custom-scrollbar max-h-80 space-y-4 overflow-y-auto pr-1">
              {weeks.map(([monday, items]) => (
                <li key={monday}>
                  <p className="metric-label mb-1.5">Semana del {formatInAppTz(monday, { day: 'numeric', month: 'short' })}</p>
                  <ul className="space-y-1">
                    {items.map((item) => (
                      <li key={item.key}>
                        <label className="flex min-h-[2.5rem] cursor-pointer items-center gap-3 rounded-[var(--radius-md)] px-2 py-1.5 text-sm hover:bg-surface-2">
                          <input
                            type="checkbox"
                            className="field-check"
                            checked={!excluded.has(item.key)}
                            onChange={() => toggle(item.key)}
                          />
                          <span className="mono w-16 shrink-0 text-xs text-fg-muted">
                            {formatInAppTz(item.day, { weekday: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-fg">
                            {item.type === 'otro' && item.note ? item.note : getTaskType(item.type).label}
                            {item.targetStage && ` a ${item.targetStage}`}
                            {item.note && item.type !== 'otro' && <span className="text-fg-muted"> · {item.note}</span>}
                          </span>
                          {(item.type === 'fertilizante' || isCustomPlanType(item.type)) && (item.stage === 'Vegetativo' || item.stage === 'Floración') && (
                            <span className="mono text-xs text-fg-muted">{STAGE_SHORT[item.stage]}{item.week}</span>
                          )}
                        </label>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Modal>
    </>
  )
}
