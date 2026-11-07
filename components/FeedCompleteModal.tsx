'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Package } from 'lucide-react'
import type { Task } from '@/app/lib/types'
import { formatDose, formatDoseWithUnit, mixLabel, mixUsage, readStoredMix, resolveMix, weekInStage } from '@/app/lib/nutrition'
import { parseDecimal } from '@/app/lib/sanitize'
import Modal from '@/components/ui/Modal'
import { Field, FormActions, Input, Switch } from '@/components/ui/form'
import { useNutritionOptions } from '@/components/NutrientPicker'

interface FeedCompleteModalProps {
  task: Task
  onClose: () => void
  /** Completa la tarea con los litros (opcionales) y si se descuenta del stock. */
  onComplete: (details: { liters: string; deductStock: boolean }) => Promise<void>
}

/**
 * Completar un fertilizante: muestra la mezcla, pide (si se quiere) los
 * litros que se prepararon y queda en la bitácora de cada planta. Con los
 * litros calcula cuánto se usó de cada producto y lo descuenta del stock.
 */
export default function FeedCompleteModal({ task, onClose, onComplete }: FeedCompleteModalProps) {
  const nutrition = useNutritionOptions()
  const { load } = nutrition
  const [liters, setLiters] = useState('')
  const [deductStock, setDeductStock] = useState(true)
  const [pending, setPending] = useState(false)

  useEffect(() => { load() }, [load])

  const options = nutrition.options
  const stored = readStoredMix(task.metadata, options?.combos, options?.fertilizers)
  const week = weekInStage(stored?.stage_days ?? 0)
  const resolved = stored ? stored.resolved ?? resolveMix(stored.items, options?.fertilizers ?? [], week) : []
  const label = stored?.label || (stored ? mixLabel(stored.items, options?.combos) : '')
  // Las plantas de la tarea al agendarla: alcanza para la vista previa de lo "por planta".
  const plantCount = task.task_plants?.length ?? 0
  const litersValue = parseDecimal(liters)
  const validLiters = litersValue !== undefined && Number.isFinite(litersValue) && litersValue > 0 ? litersValue : 0
  const usage = mixUsage(resolved, validLiters, plantCount)
  const tracked = resolved.filter((item) => options?.fertilizers.find((product) => product.id === item.fertilizer_id)?.stock_ml != null)
  const canDeduct = tracked.length > 0 && usage.some((line) => line.total !== null && tracked.some((item) => item.fertilizer_id === line.fertilizer_id))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    await onComplete({ liters, deductStock: canDeduct && deductStock })
    setPending(false)
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Completar fertilizante"
      description={label ? `${label} · semana ${week}` : `Semana ${week}`}
      size="sm"
      footer={
        <FormActions form="feed-complete-form" onCancel={onClose} icon={CheckCircle2} pending={pending} pendingLabel="Completando…" submitLabel="Completar" />
      }
    >
      <form id="feed-complete-form" onSubmit={submit} className="space-y-5" noValidate>
        <ul className="divide-y divide-[color:var(--border)] rounded-[var(--radius-md)] border border-line bg-surface-2 text-sm">
          {resolved.map((item) => {
            const line = usage.find((entry) => entry.fertilizer_id === item.fertilizer_id)
            const product = options?.fertilizers.find((entry) => entry.id === item.fertilizer_id)
            const short = product?.stock_ml != null && line?.total != null && line.total > product.stock_ml
            return (
              <li key={item.fertilizer_id} className="flex items-baseline justify-between gap-3 px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-fg">{item.name}</span>
                  <span className="block text-xs text-fg-muted">{formatDoseWithUnit(item.dose, item.unit, item.basis)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="mono font-semibold text-fg">
                    {line?.total != null ? `${formatDose(line.total)} ${item.unit}` : '–'}
                  </span>
                  {product?.stock_ml != null && (
                    <span className={`block text-xs ${short ? 'font-semibold text-[color:var(--warning)]' : 'text-fg-muted'}`}>
                      {short ? 'no alcanza: ' : ''}quedan {formatDose(product.stock_ml)} {product.unit}
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>

        <Field
          label="Litros que preparaste"
          optional
          hint="Con los litros queda anotado cuánto se usó de cada producto."
        >
          <Input
            data-autofocus
            type="text"
            inputMode="decimal"
            suffix="L"
            className="metric text-lg"
            value={liters}
            onChange={(e) => setLiters(e.target.value)}
            placeholder="10"
          />
        </Field>

        {canDeduct && (
          <Switch
            checked={deductStock}
            onChange={setDeductStock}
            icon={<Package size={17} />}
            label="Descontar del stock"
            description="Resta lo usado de cada producto que lleva la cuenta."
          />
        )}

        <p className="text-xs leading-snug text-fg-muted">
          Queda en la bitácora de cada planta. Si te equivocaste, tocá “Deshacer” en el aviso.
        </p>
      </form>
    </Modal>
  )
}
