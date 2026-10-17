'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarRange, Loader2, Trash2 } from 'lucide-react'
import { createGrowPlan, deleteGrowPlan } from '@/app/actions/grow-plan'
import { getFertilizerCombos, getFertilizers } from '@/app/actions/fertilizers'
import { buildGrowPlan, countByType } from '@/app/lib/grow-plan'
import type { PlanItem } from '@/app/lib/grow-plan'
import type { NutritionSelection } from '@/app/lib/nutrition'
import type { StageName } from '@/app/lib/stage-logic'
import { addDaysToKey, formatInAppTz, todayKey } from '@/app/lib/dates'
import { getTaskType } from '@/app/lib/constants'
import { useToast } from '@/app/context/ToastContext'
import Modal from '@/components/ui/Modal'
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

type Option = { value: string; label: string }

const parseSelection = (value: string): NutritionSelection | null => {
  const [type, id] = value.split(':')
  return (type === 'product' || type === 'combo') && Number(id) ? { type, id: Number(id) } : null
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
  const [vegNutrition, setVegNutrition] = useState('')
  const [flowerNutrition, setFlowerNutrition] = useState('')
  const [include, setInclude] = useState({ stageChange: true, harvest: true, flush: true })
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  const [products, setProducts] = useState<{ fertilizers: Option[]; combos: Option[] }>({ fertilizers: [], combos: [] })
  const loaded = useRef(false)

  const open = async () => {
    setIsOpen(true)
    if (loaded.current) return
    loaded.current = true
    const [fertRes, comboRes] = await Promise.all([getFertilizers(), getFertilizerCombos()])
    setProducts({
      fertilizers: (fertRes.data ?? []).map((f) => ({ value: `product:${f.id}`, label: f.name })),
      combos: (comboRes.data ?? []).map((c) => ({ value: `combo:${c.id}`, label: c.name })),
    })
  }

  const options = useMemo(() => ({
    vegDays: Number(vegDays) || defaultVegDays,
    flowerDays: Number(flowerDays) || defaultFlowerDays,
    waterEvery: Number(waterEvery) || 3,
    feedEvery: Number(feedEvery),
    flushDays: Number(flushDays) || 0,
    vegNutrition: parseSelection(vegNutrition),
    flowerNutrition: parseSelection(flowerNutrition),
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

  const field = (id: string, label: string, value: string, set: (v: string) => void, hint?: string) => (
    <div className="field">
      <label htmlFor={id} className="field-label">{label}</label>
      <input id={id} type="number" min={0} className="field-input" value={value} onChange={(e) => set(e.target.value)} />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )

  const productSelect = (id: string, label: string, value: string, set: (v: string) => void) => (
    <div className="field">
      <label htmlFor={id} className="field-label">{label}</label>
      <select id={id} className="field-input" value={value} onChange={(e) => set(e.target.value)}>
        <option value="">Sin fertilizante</option>
        {products.combos.length > 0 && (
          <optgroup label="Combos">
            {products.combos.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
        )}
        {products.fertilizers.length > 0 && (
          <optgroup label="Productos">
            {products.fertilizers.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
        )}
      </select>
    </div>
  )

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
          <>
            <span className="mr-auto text-sm text-fg-muted" role="status">
              {selected.length} {selected.length === 1 ? 'tarea' : 'tareas'}
            </span>
            <button type="button" className="btn btn-ghost" onClick={() => setIsOpen(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving || selected.length === 0}>
              {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              Crear {selected.length} {selected.length === 1 ? 'tarea' : 'tareas'}
            </button>
          </>
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
              <p className="rounded-[var(--radius-md)] border border-line bg-surface-2 p-3 text-sm text-fg-muted">
                Este ciclo ya tiene {pendingPlanTasks} tareas pendientes de un plan. Si armás otro, conviene borrar el anterior primero.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stage !== 'Floración' && field('plan-veg', 'Días de vegetativo', vegDays, setVegDays, 'Desde que empieza')}
              {field('plan-flower', 'Días de floración', flowerDays, setFlowerDays)}
              {field('plan-water', 'Regar cada (días)', waterEvery, setWaterEvery)}
              {field('plan-feed', 'Fertilizar 1 de cada', feedEvery, setFeedEvery, '0 = nunca')}
              {field('plan-flush', 'Lavado (días antes)', flushDays, setFlushDays, 'Con agua sola')}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {stage !== 'Floración' && productSelect('plan-veg-product', 'Fertilizante en vegetativo', vegNutrition, setVegNutrition)}
              {productSelect('plan-flower-product', 'Fertilizante en floración', flowerNutrition, setFlowerNutrition)}
            </div>

            <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg">
              <legend className="sr-only">Qué más incluir</legend>
              {([
                ['stageChange', 'Cambios de etapa'],
                ['flush', 'Lavado de raíces'],
                ['harvest', 'Cosecha'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[color:var(--brand)]"
                    checked={include[key]}
                    onChange={(e) => setInclude((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            <div className="rounded-[var(--radius-md)] border border-line p-3 text-sm">
              <p className="text-fg">
                Floración desde el <strong>{formatInAppTz(plan.flowerStart, { day: 'numeric', month: 'short' })}</strong>, cosecha el{' '}
                <strong>{formatInAppTz(plan.harvestDay, { day: 'numeric', month: 'short', year: 'numeric' })}</strong>.
              </p>
              <p className="mt-1 text-fg-muted">
                {counts.riego + counts.fertilizante} riegos ({counts.fertilizante} con fertilizante)
                {counts.cambio_etapa > 0 && ` · ${counts.cambio_etapa} ${counts.cambio_etapa === 1 ? 'cambio' : 'cambios'} de etapa`}
                {counts.lavado > 0 && ' · lavado'}{counts.cosechar > 0 && ' · cosecha'}
                {plan.truncated && ' · se cortó en 200 tareas'}
              </p>
            </div>

            <ol className="custom-scrollbar max-h-80 space-y-4 overflow-y-auto pr-1">
              {weeks.map(([monday, items]) => (
                <li key={monday}>
                  <p className="metric-label mb-1.5">Semana del {formatInAppTz(monday, { day: 'numeric', month: 'short' })}</p>
                  <ul className="space-y-1">
                    {items.map((item) => (
                      <li key={item.key}>
                        <label className="flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-1.5 text-sm hover:bg-surface-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[color:var(--brand)]"
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
