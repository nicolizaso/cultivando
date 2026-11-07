'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarRange, Trash2 } from 'lucide-react'
import { createGrowPlan, deleteGrowPlan } from '@/app/actions/grow-plan'
import { buildGrowPlan, countByType } from '@/app/lib/grow-plan'
import type { PlanItem } from '@/app/lib/grow-plan'
import { mixLabel } from '@/app/lib/nutrition'
import type { MixItem } from '@/app/lib/nutrition'
import NutrientPicker, { useNutritionOptions } from '@/components/NutrientPicker'
import type { StageName } from '@/app/lib/stage-logic'
import { addDaysToKey, formatInAppTz, todayKey } from '@/app/lib/dates'
import { getTaskType } from '@/app/lib/constants'
import { useToast } from '@/app/context/ToastContext'
import Modal from '@/components/ui/Modal'
import { Disclosure, Field, FormActions, FormAlert, FormSection, MultiChoice, Stepper } from '@/components/ui/form'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface GrowPlanModalProps {
  cycleId: number
  /** Etapa del ciclo y desde cuándo, como lo calcula la página. */
  stage: StageName | null
  stageStart: string | null
  /** Sugerencias: los promedios de la genética o los valores de siempre. */
  defaultVegDays: number
  defaultFlowerDays: number
  /** Tareas pendientes de planes anteriores de este ciclo. */
  pendingPlanTasks: number
}

/**
 * Arma el calendario del ciclo de una vez. Se ve antes de crear: cada tarea
 * se puede destildar, y lo que se crea son tareas comunes de la agenda
 * (marcadas como parte del plan, para poder borrarlas juntas).
 */
export default function GrowPlanModal(props: GrowPlanModalProps) {
  const { cycleId, stage, stageStart, defaultVegDays, defaultFlowerDays, pendingPlanTasks } = props
  const router = useRouter()
  const { showToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const [vegDays, setVegDays] = useState(String(defaultVegDays))
  const [flowerDays, setFlowerDays] = useState(String(defaultFlowerDays))
  const [waterEvery, setWaterEvery] = useState('3')
  const [feedEvery, setFeedEvery] = useState('2')
  const [flushDays, setFlushDays] = useState('10')
  const [vegNutrition, setVegNutrition] = useState<MixItem[]>([])
  const [flowerNutrition, setFlowerNutrition] = useState<MixItem[]>([])
  const [include, setInclude] = useState({ stageChange: true, harvest: true, flush: true })
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  const nutrition = useNutritionOptions()
  const [openMix, setOpenMix] = useState<'veg' | 'flower' | null>(null)

  const open = () => {
    setIsOpen(true)
    nutrition.load()
  }

  const options = useMemo(() => ({
    vegDays: Number(vegDays) || defaultVegDays,
    flowerDays: Number(flowerDays) || defaultFlowerDays,
    waterEvery: Number(waterEvery) || 3,
    feedEvery: Number(feedEvery),
    flushDays: Number(flushDays) || 0,
    vegNutrition: vegNutrition.length > 0 ? vegNutrition : null,
    flowerNutrition: flowerNutrition.length > 0 ? flowerNutrition : null,
    include,
  }), [vegDays, flowerDays, waterEvery, feedEvery, flushDays, vegNutrition, flowerNutrition, include, defaultVegDays, defaultFlowerDays])

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
            disabled={selected.length === 0}
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
                {stepper('Floración', flowerDays, setFlowerDays, { suffix: 'días', min: 1 })}
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

            <div className="rounded-[var(--radius-lg)] bg-brand-soft p-4 text-sm">
              <p className="text-fg">
                Floración desde el <strong>{formatInAppTz(plan.flowerStart, { day: 'numeric', month: 'short' })}</strong>, cosecha el{' '}
                <strong>{formatInAppTz(plan.harvestDay, { day: 'numeric', month: 'short', year: 'numeric' })}</strong>.
              </p>
              <p className="mt-1 text-fg-muted">
                {counts.riego + counts.fertilizante} riegos ({counts.fertilizante} con fertilizante)
                {counts.cambio_etapa > 0 && `, ${counts.cambio_etapa} ${counts.cambio_etapa === 1 ? 'cambio' : 'cambios'} de etapa`}
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
                            {getTaskType(item.type).label}
                            {item.targetStage && ` a ${item.targetStage}`}
                          </span>
                          {item.type === 'fertilizante' && (
                            <span className="text-xs text-fg-muted">semana {item.week} de {item.stage.toLowerCase()}</span>
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
