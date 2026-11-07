'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Check, History, Layers, Minus, Plus, RotateCcw, Save, Search, TriangleAlert, X } from 'lucide-react'
import { createFertilizerCombo, getNutritionOptions } from '@/app/actions/fertilizers'
import {
  FERTILIZER_STAGE_LABELS, MAX_DOSE, comboIncluded, doseUnitShort, formatDose, formatDoseWithUnit, mixRecipe, mixUsage,
  productDoseText, resolveMix, setItemDose, stageWarnings, stageWarningText, toggleCombo, toggleProduct,
} from '@/app/lib/nutrition'
import type { MixItem } from '@/app/lib/nutrition'
import { parseDecimal } from '@/app/lib/sanitize'
import type { Fertilizer, FertilizerCombo, NutritionOptions } from '@/app/lib/types'
import { FieldGroup, FormAlert, Input, Stepper, accentStyle } from '@/components/ui/form'

export type OptionsState = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Productos, combos y la última mezcla, pedidos una sola vez (la primera vez
 * que hacen falta). `reload` vuelve a pedirlos, por ejemplo después de guardar
 * un combo nuevo desde el selector.
 */
export function useNutritionOptions() {
  const [options, setOptions] = useState<NutritionOptions | null>(null)
  const [state, setState] = useState<OptionsState>('idle')
  const status = useRef<OptionsState>('idle')

  const fetchOptions = useCallback(async (force: boolean) => {
    if (status.current === 'loading' || (!force && status.current === 'ready')) return
    status.current = 'loading'
    setState('loading')
    const res = await getNutritionOptions()
    status.current = res.data ? 'ready' : 'error'
    if (res.data) setOptions(res.data)
    setState(status.current)
  }, [])

  const load = useCallback(() => fetchOptions(false), [fetchOptions])
  const reload = useCallback(() => fetchOptions(true), [fetchOptions])
  return { options, state, load, reload }
}

const round2 = (value: number) => Math.round(value * 100) / 100
const stepFor = (value: number) => (value < 1 ? 0.1 : value < 5 ? 0.5 : 1)

/** Dosis decimal con − y +: se ajusta con el pulgar y también se escribe ("1,5"). */
function DoseStepper({ value, unit, basis, label, onChange }: {
  value: number | null
  unit: Fertilizer['unit']
  basis: Fertilizer['dose_basis']
  label: string
  onChange: (dose: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const current = value ?? 0
  const clamp = (n: number) => Math.min(MAX_DOSE, Math.max(0, round2(n)))

  return (
    <div className="stepper w-[10.5rem] shrink-0">
      <button
        type="button"
        className="stepper-btn"
        onClick={() => onChange(clamp(current - stepFor(Math.max(0, current - 0.01))))}
        disabled={current <= 0}
        aria-label={`Menos ${label}`}
      >
        <Minus size={16} strokeWidth={2.5} aria-hidden="true" />
      </button>
      <span className="stepper-value">
        <input
          type="text"
          inputMode="decimal"
          className="stepper-input !text-base"
          value={draft ?? (value === null ? '' : formatDose(value))}
          placeholder="?"
          onChange={(e) => {
            setDraft(e.target.value)
            const parsed = parseDecimal(e.target.value)
            if (parsed !== undefined && Number.isFinite(parsed) && parsed >= 0 && parsed <= MAX_DOSE) onChange(round2(parsed))
          }}
          onBlur={() => setDraft(null)}
          onFocus={(e) => e.target.select()}
          style={{ width: `${Math.max(2.5, (draft ?? (value === null ? '?' : formatDose(value))).length + 0.5)}ch` }}
          aria-label={`Dosis de ${label}`}
        />
        <span className="stepper-suffix">{doseUnitShort(unit, basis)}</span>
      </span>
      <button
        type="button"
        className="stepper-btn"
        onClick={() => onChange(clamp(current + stepFor(current)))}
        disabled={current >= MAX_DOSE}
        aria-label={`Más ${label}`}
      >
        <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  )
}

/** ¿La mezcla es exactamente un combo que ya existe (mismos productos y dosis)? */
function matchesCombo(items: MixItem[], combos: FertilizerCombo[]): boolean {
  return combos.some((combo) =>
    combo.products.length === items.length &&
    combo.products.every((product) => {
      const item = items.find((entry) => entry.fertilizer_id === product.fertilizer_id)
      return item !== undefined && (item.custom_dose ?? null) === (product.dose ?? null)
    })
  )
}

interface NutrientPickerProps {
  options: NutritionOptions | null
  state: OptionsState
  /** Volver a pedir las opciones (después de guardar un combo). */
  onReload: () => void
  value: MixItem[]
  onChange: (items: MixItem[]) => void
  /** Semana de la etapa con la que se calculan las dosis. */
  week: number
  /** Si viene, la semana se puede cambiar desde el selector. */
  onWeekChange?: (week: number) => void
  /** Una aclaración sobre la semana (por ejemplo, objetivos en semanas distintas). */
  weekNote?: ReactNode
  /** Etapas de las plantas, para avisar si un producto no corresponde. */
  stages?: string[]
  /** Con litros (y plantas), cada producto muestra cuánto va en total. */
  liters?: number
  plantCount?: number
  legend?: ReactNode
  hint?: ReactNode
  /** Muestra la línea "Preparar: …" que va a quedar en los detalles. */
  showRecipe?: boolean
  allowSaveCombo?: boolean
  /** Sin la semana a la vista (en el plan, cada riego tiene la suya). */
  hideWeek?: boolean
}

/**
 * Elegir qué lleva un riego o una tarea: combos y productos a la vista (los
 * dos se pueden combinar), y abajo la mezcla con la dosis de cada producto,
 * que se puede ajustar. Reemplaza al desplegable que dejaba elegir un solo
 * combo o un solo producto.
 */
export default function NutrientPicker({
  options, state, onReload, value, onChange, week, onWeekChange, weekNote, stages = [],
  liters, plantCount, legend = 'Fertilizantes', hint, showRecipe = false, allowSaveCombo = true, hideWeek = false,
}: NutrientPickerProps) {
  const [query, setQuery] = useState('')
  const [comboForm, setComboForm] = useState<{ name: string; pending: boolean; error: string | null } | null>(null)
  const [savedCombo, setSavedCombo] = useState<string | null>(null)

  const fertilizers = useMemo(() => options?.fertilizers ?? [], [options])
  const combos = options?.combos ?? []
  const byId = useMemo(() => new Map(fertilizers.map((product) => [product.id, product])), [fertilizers])
  const selected = new Set(value.map((item) => item.fertilizer_id))

  const fits = useCallback(
    (product: Fertilizer) => stageWarnings([{ fertilizer_id: product.id, name: product.name, stage_category: product.stage_category }], stages).length === 0,
    [stages]
  )

  // Los de la etapa de las plantas primero; después el resto, por nombre.
  const q = query.trim().toLowerCase()
  const visible = useMemo(() => {
    const list = q
      ? fertilizers.filter((product) => `${product.name} ${product.brand ?? ''}`.toLowerCase().includes(q))
      : fertilizers
    return [...list].sort((a, b) => Number(fits(b)) - Number(fits(a)))
  }, [fertilizers, q, fits])

  const resolved = resolveMix(value, fertilizers, week)
  const usage = liters !== undefined || plantCount !== undefined ? mixUsage(resolved, liters ?? 0, plantCount ?? 0) : null
  const warnings = stageWarnings(resolved, stages)
  const lastMix = options?.lastMix ?? null

  const saveCombo = async () => {
    if (!comboForm) return
    const name = comboForm.name.trim()
    if (!name) {
      setComboForm({ ...comboForm, error: 'Ponele un nombre.' })
      return
    }
    setComboForm({ ...comboForm, pending: true, error: null })
    const res = await createFertilizerCombo({
      name,
      items: value.map((item) => ({ fertilizer_id: item.fertilizer_id, dose: item.custom_dose })),
    })
    if (res.error) {
      setComboForm({ ...comboForm, pending: false, error: res.error })
      return
    }
    setComboForm(null)
    setSavedCombo(name)
    onReload()
  }

  return (
    <FieldGroup legend={legend} optional>
      <div className="space-y-4">
        {/* La ayuda arriba: abajo quedaba lejos, después de toda la mezcla. */}
        {hint && <p className="field-hint -mt-1">{hint}</p>}
        {(state === 'idle' || state === 'loading') && (
          <div className="space-y-2" aria-busy="true" aria-label="Cargando productos">
            <div className="skeleton h-9 w-2/3 rounded-full" />
            <div className="grid grid-cols-2 gap-2">
              <div className="skeleton h-[4.5rem] rounded-[var(--radius-md)]" />
              <div className="skeleton h-[4.5rem] rounded-[var(--radius-md)]" />
            </div>
          </div>
        )}

        {state === 'error' && (
          <FormAlert>
            No se pudieron cargar los productos.{' '}
            <button type="button" className="underline" onClick={onReload}>Probar de nuevo</button>
          </FormAlert>
        )}

        {state === 'ready' && fertilizers.length === 0 && (
          <FormAlert tone="info">
            Todavía no cargaste productos.{' '}
            <Link href="/fertilizers" className="font-semibold text-[color:var(--brand-text)] underline">Cargalos en Nutrición</Link>{' '}
            con su dosis y la app calcula cada mezcla sola.
          </FormAlert>
        )}

        {state === 'ready' && lastMix && value.length === 0 && (
          <button
            type="button"
            className="choice choice-sm w-full justify-start text-left"
            onClick={() => onChange(lastMix.items)}
          >
            <History size={15} className="choice-icon" aria-hidden="true" />
            <span className="min-w-0 truncate">
              Repetir la última: <span className="font-bold">{lastMix.label}</span>
            </span>
          </button>
        )}

        {state === 'ready' && combos.length > 0 && (
          <div className="space-y-2">
            <p className="metric-label">Combos</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Combos">
              {combos.map((combo) => {
                const pressed = comboIncluded(value, combo)
                return (
                  <button
                    key={combo.id}
                    type="button"
                    className="choice choice-sm"
                    style={accentStyle('var(--accent-violet)')}
                    aria-pressed={pressed}
                    onClick={() => onChange(toggleCombo(value, combo))}
                    title={combo.products.map((product) => product.name).join(' + ')}
                  >
                    {pressed
                      ? <Check size={14} strokeWidth={2.75} className="choice-check -ml-0.5" aria-hidden="true" />
                      : <Layers size={14} className="choice-icon -ml-0.5" aria-hidden="true" />}
                    {combo.name}
                    <span className="mono text-[0.6875rem] font-semibold opacity-70" aria-label={`${combo.products.length} productos`}>
                      {combo.products.length}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {state === 'ready' && fertilizers.length > 0 && (
          <div className="space-y-2">
            <p className="metric-label">Productos</p>
            {fertilizers.length > 8 && (
              <Input
                type="search"
                leading={<Search size={16} />}
                placeholder="Buscar producto"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar producto"
              />
            )}
            <div className="grid grid-cols-2 gap-2">
              {visible.map((product) => {
                const offStage = !fits(product)
                const low = product.stock_ml !== null && product.low_stock_ml !== null && product.stock_ml <= product.low_stock_ml
                return (
                  <label key={product.id} className="choice choice-tile !min-h-[4.25rem]">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selected.has(product.id)}
                      onChange={() => onChange(toggleProduct(value, product))}
                    />
                    <span className="pr-5 leading-tight">{product.name}</span>
                    <span className="choice-tile-desc">{productDoseText(product)}</span>
                    {offStage && product.stage_category && (
                      <span className="choice-tile-desc flex items-center gap-1 !text-[color:var(--warning)]">
                        <TriangleAlert size={12} aria-hidden="true" />
                        Es de {FERTILIZER_STAGE_LABELS[product.stage_category].toLowerCase()}
                      </span>
                    )}
                    {low && <span className="choice-tile-desc !text-[color:var(--warning)]">Queda poco</span>}
                    <Check size={16} strokeWidth={2.75} className="choice-check" aria-hidden="true" />
                  </label>
                )
              })}
              {visible.length === 0 && <p className="col-span-2 text-sm text-fg-muted">Ningún producto coincide con “{query}”.</p>}
            </div>
          </div>
        )}

        {value.length > 0 && (
          <div className="space-y-3 rounded-[var(--radius-lg)] border border-line bg-surface-2 p-3 sm:p-4" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-fg">
                La mezcla <span className="font-normal text-fg-muted">· {value.length} {value.length === 1 ? 'producto' : 'productos'}</span>
              </p>
              {hideWeek ? null : onWeekChange ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-fg-muted">Semana</span>
                  <Stepper value={week} onChange={onWeekChange} min={1} max={30} unitName="semana" className="!w-[8.5rem] !min-h-[2.75rem]" aria-label="Semana de la etapa" />
                </div>
              ) : (
                <span className="chip chip-neutral">Semana {week}</span>
              )}
            </div>
            {weekNote && <p className="text-xs leading-snug text-fg-muted">{weekNote}</p>}

            <ul className="divide-y divide-[color:var(--border)]">
              {resolved.map((item) => {
                const product = byId.get(item.fertilizer_id)
                const line = usage?.find((entry) => entry.fertilizer_id === item.fertilizer_id)
                const short = product && product.stock_ml !== null && line?.total != null && line.total > product.stock_ml
                return (
                  <li
                    key={item.fertilizer_id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-fg">{item.name}</p>
                      <p className="text-xs leading-snug text-fg-muted">
                        {item.missing
                          ? 'Ya no está en tus productos'
                          : item.custom
                            ? <>
                                Dosis propia
                                {product && (
                                  <button
                                    type="button"
                                    className="ml-1 inline-flex items-center gap-0.5 font-semibold text-[color:var(--brand-text)]"
                                    onClick={() => onChange(setItemDose(value, item.fertilizer_id, null))}
                                  >
                                    <RotateCcw size={11} aria-hidden="true" />
                                    usar {productDoseText(product)}
                                  </button>
                                )}
                              </>
                            : item.dose === null
                              ? 'Sin dosis cargada: escribila acá'
                              : product?.dosage_type === 'semanal'
                                ? (hideWeek ? 'Sigue la tabla semana a semana' : `De la tabla, semana ${week}`)
                                : 'Del producto'}
                        {product && product.stock_ml !== null && line && (
                          <span className={short ? 'font-semibold text-[color:var(--warning)]' : ''}>
                            {' · '}{short ? 'no alcanza, ' : ''}quedan {formatDose(product.stock_ml)} {product.unit}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-icon btn-icon-sm sm:order-last"
                      onClick={() => onChange(value.filter((entry) => entry.fertilizer_id !== item.fertilizer_id))}
                      aria-label={`Quitar ${item.name}`}
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                    <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
                      <DoseStepper
                        value={item.dose}
                        unit={item.unit}
                        basis={item.basis}
                        label={item.name}
                        onChange={(dose) => onChange(setItemDose(value, item.fertilizer_id, dose))}
                      />
                      {line?.total != null && (
                        <span className={`mono whitespace-nowrap text-sm font-semibold ${short ? 'text-[color:var(--warning)]' : 'text-fg'}`}>
                          {formatDose(line.total)} {item.unit}
                          <span className="block text-[0.6875rem] font-medium text-fg-muted">en total</span>
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            {warnings.map((warning) => (
              <FormAlert key={warning.fertilizer_id} tone="warning">{stageWarningText(warning)}</FormAlert>
            ))}

            {showRecipe && (
              <p className="text-xs leading-snug text-fg-muted">
                <span className="font-semibold text-fg">Queda anotado: </span>
                {mixRecipe(resolved, week)}
              </p>
            )}

            {savedCombo && <p className="text-xs font-semibold text-[color:var(--success)]" role="status">Combo “{savedCombo}” guardado.</p>}

            {allowSaveCombo && value.length >= 2 && !matchesCombo(value, combos) && (
              comboForm ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <Input
                        type="text"
                        autoComplete="off"
                        autoFocus
                        placeholder="Nombre del combo"
                        value={comboForm.name}
                        onChange={(e) => setComboForm({ ...comboForm, name: e.target.value, error: null })}
                        onKeyDown={(e) => {
                          // Enter guarda el combo, no manda el formulario de afuera.
                          if (e.key === 'Enter') { e.preventDefault(); saveCombo() }
                          if (e.key === 'Escape') { e.preventDefault(); setComboForm(null) }
                        }}
                        aria-label="Nombre del combo nuevo"
                        aria-invalid={comboForm.error ? true : undefined}
                      />
                    </div>
                    <button type="button" className="btn btn-primary" onClick={saveCombo} disabled={comboForm.pending}>
                      Guardar
                    </button>
                  </div>
                  {comboForm.error && <p className="field-error">{comboForm.error}</p>}
                </div>
              ) : (
                <button type="button" className="btn btn-sm btn-ghost -ml-2" onClick={() => { setSavedCombo(null); setComboForm({ name: '', pending: false, error: null }) }}>
                  <Save size={15} aria-hidden="true" />
                  Guardar esta mezcla como combo
                </button>
              )
            )}
          </div>
        )}
      </div>
    </FieldGroup>
  )
}

/** "Flora · semana 3" o "Lab 5 ml/L + Top Max 1 ml/L": resumen corto de una mezcla resuelta. */
export function mixSummaryText(items: { name: string; dose: number | null; unit: Fertilizer['unit']; basis: Fertilizer['dose_basis'] }[]): string {
  return items.map((item) => `${item.name} ${formatDoseWithUnit(item.dose, item.unit, item.basis)}`).join(' + ')
}
