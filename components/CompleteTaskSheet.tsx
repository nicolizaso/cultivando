'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Package, Plus, Warehouse } from 'lucide-react'
import { getCompletionContext } from '@/app/actions/tasks'
import type { CompleteTaskInput } from '@/app/actions/tasks'
import type { Task } from '@/app/lib/types'
import { getTaskType } from '@/app/lib/constants'
import { addDaysToKey, dateKey, formatInAppTz, todayKey } from '@/app/lib/dates'
import { formatDose, formatDoseWithUnit, hasStoredMix, mixLabel, mixUsage, readStoredMix, resolveMix, weekInStage } from '@/app/lib/nutrition'
import { parseDecimal } from '@/app/lib/sanitize'
import { completionNeeds } from '@/app/lib/task-effects'
import Modal from '@/components/ui/Modal'
import { ChoiceGroup, ChoiceOrSelect, DateField, Field, FieldGroup, FormActions, FormAlert, Input, Switch, Textarea } from '@/components/ui/form'
import type { QuickDate } from '@/components/ui/form'
import { useNutritionOptions } from '@/components/NutrientPicker'

type Context = Exclude<Awaited<ReturnType<typeof getCompletionContext>>, { error: string }>

interface CompleteTaskSheetProps {
  task: Task
  onClose: () => void
  /** Completa la tarea; devuelve true si salió bien (la hoja se cierra). */
  onSubmit: (input: CompleteTaskInput) => Promise<boolean>
}

const NEW_CYCLE = -1

/**
 * La hoja que se abre al completar una tarea cuando hay algo que preguntar:
 * el día en que se hizo (si está atrasada), los litros de una mezcla, los
 * pesos de una cosecha, a dónde va una mudanza o el motivo de una baja. Lo
 * que no hace falta no aparece; una tarea sin preguntas se completa de un
 * toque y nunca llega acá.
 */
export default function CompleteTaskSheet({ task, onClose, onSubmit }: CompleteTaskSheetProps) {
  const hasMix = hasStoredMix(task.metadata)
  const needs = completionNeeds(task, hasMix)
  const typeDef = getTaskType(task.type)
  const today = todayKey()
  const dueDay = dateKey(task.due_date) ?? today

  const [doneOn, setDoneOn] = useState(today)
  const [pending, setPending] = useState(false)

  // Contexto del servidor: las plantas (cosecha) y el destino (mudanza).
  const wantsContext = needs.harvest || needs.ambiente
  const [context, setContext] = useState<Context | null>(null)
  const [contextError, setContextError] = useState<string | null>(null)
  const [spaceId, setSpaceId] = useState<number | null>(null)
  const [cycleId, setCycleId] = useState<number | null>(null)
  const [newCycleName, setNewCycleName] = useState('')

  useEffect(() => {
    if (!wantsContext) return
    let cancelled = false
    getCompletionContext(task.id).then((result) => {
      if (cancelled) return
      if ('error' in result) setContextError(result.error)
      else {
        setContext(result)
        setNewCycleName(result.ambiente?.suggestedCycleName ?? '')
        if (result.ambiente?.needsCycle && result.ambiente.cycles.length === 0) setCycleId(NEW_CYCLE)
      }
    })
    return () => { cancelled = true }
  }, [wantsContext, task.id])

  const chooseSpace = async (id: number) => {
    setSpaceId(id)
    setCycleId(null)
    const result = await getCompletionContext(task.id, id)
    if ('error' in result) return setContextError(result.error)
    setContext(result)
    setNewCycleName(result.ambiente?.suggestedCycleName ?? '')
    if (result.ambiente?.needsCycle && result.ambiente.cycles.length === 0) setCycleId(NEW_CYCLE)
  }

  // Mezcla (fertilizante).
  const nutrition = useNutritionOptions()
  const { load } = nutrition
  useEffect(() => { if (needs.feed) load() }, [needs.feed, load])
  const [liters, setLiters] = useState('')
  const [deductStock, setDeductStock] = useState(true)
  const options = nutrition.options
  const stored = needs.feed ? readStoredMix(task.metadata, options?.combos, options?.fertilizers) : null
  const week = weekInStage(stored?.stage_days ?? 0)
  const resolved = stored ? stored.resolved ?? resolveMix(stored.items, options?.fertilizers ?? [], week) : []
  const plantCount = task.task_plants?.length ?? 0
  const litersValue = parseDecimal(liters)
  const usage = mixUsage(resolved, litersValue !== undefined && Number.isFinite(litersValue) && litersValue > 0 ? litersValue : 0, plantCount)
  const tracked = resolved.filter((item) => options?.fertilizers.find((product) => product.id === item.fertilizer_id)?.stock_ml != null)
  const canDeduct = tracked.length > 0 && usage.some((line) => line.total !== null && tracked.some((item) => item.fertilizer_id === line.fertilizer_id))

  // Cosecha y baja.
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')

  const ambiente = context?.ambiente ?? null
  const destinationName = ambiente?.spaceName ?? null
  const needsSpace = needs.ambiente && !task.target_space_id
  const needsCycle = Boolean(ambiente?.needsCycle)
  const contextReady = !wantsContext || context !== null || contextError !== null
  const ambienteReady = !needs.ambiente || (
    (!needsSpace || spaceId !== null) &&
    (!needsCycle || (cycleId !== null && (cycleId !== NEW_CYCLE || newCycleName.trim() !== '')))
  )

  const quickDays: QuickDate[] = [
    { label: 'Hoy', value: today },
    { label: 'Ayer', value: addDaysToKey(today, -1) },
    ...(dueDay < addDaysToKey(today, -1) ? [{ label: 'El día agendado', value: dueDay }] : []),
  ]

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!ambienteReady) return
    setPending(true)
    const ok = await onSubmit({
      doneOn: needs.date ? doneOn : null,
      ...(needs.feed ? { liters, deductStock: canDeduct && deductStock } : {}),
      ...(needs.harvest ? { weights } : {}),
      ...(needs.confirm === 'muerta' && note.trim() ? { note } : {}),
      ...(needs.ambiente ? {
        spaceId: needsSpace ? spaceId : null,
        cycleId: needsCycle && cycleId !== NEW_CYCLE ? cycleId : null,
        newCycleName: needsCycle && cycleId === NEW_CYCLE ? newCycleName : '',
      } : {}),
    })
    setPending(false)
    if (ok) onClose()
  }

  const submitLabel = needs.confirm === 'muerta' ? 'Completar y archivar' : needs.confirm === 'ambiente' ? 'Completar y mudar' : 'Completar'

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Completar: ${task.type === 'otro' ? task.title : typeDef.label}`}
      description={needs.feed && stored ? `${stored.label || mixLabel(stored.items, options?.combos)} · semana ${week}` : undefined}
      size="sm"
      dismissOnBackdrop={!pending}
      footer={
        <FormActions
          form="complete-task-form"
          onCancel={onClose}
          icon={CheckCircle2}
          pending={pending}
          pendingLabel="Completando…"
          submitLabel={submitLabel}
          disabled={!contextReady || !ambienteReady}
          tone={needs.confirm === 'muerta' ? 'danger' : 'primary'}
        />
      }
    >
      <form id="complete-task-form" onSubmit={submit} className="space-y-5" noValidate>
        {needs.date && (
          <DateField
            label="¿Qué día la hiciste?"
            value={doneOn}
            onChange={setDoneOn}
            max={today}
            quick={quickDays}
            hint={`Estaba agendada para el ${formatInAppTz(dueDay, { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '')}.`}
          />
        )}

        {needs.confirm === 'muerta' && (
          <>
            <FormAlert tone="warning">
              Las plantas que alcanza se archivan y dejan de aparecer en el cultivo activo. Si te equivocaste, desmarcala y vuelven.
            </FormAlert>
            <Field label="Motivo" optional>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hongos, plaga, se secó…" />
            </Field>
          </>
        )}

        {needs.feed && (
          <>
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

            <Field label="Litros que preparaste" optional hint="Con los litros queda anotado cuánto se usó de cada producto.">
              <Input
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
          </>
        )}

        {needs.harvest && (
          <FieldGroup
            legend="Peso húmedo"
            optional
            hint="Pasan a Secado y se les crea la ficha de cosecha. El peso lo podés cargar ahora o después."
          >
            {!context && !contextError ? (
              <p className="flex items-center gap-2 text-sm text-fg-muted"><Loader2 size={15} className="animate-spin" aria-hidden="true" />Cargando plantas…</p>
            ) : context && context.plants.length > 0 ? (
              <ul className="space-y-2">
                {context.plants.map((plant) => (
                  <li key={plant.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium text-fg">{plant.name}</span>
                    {plant.hasHarvest ? (
                      <span className="shrink-0 text-xs text-fg-muted">Ya tiene ficha</span>
                    ) : (
                      <Input
                        type="text"
                        inputMode="decimal"
                        suffix="g"
                        aria-label={`Peso húmedo de ${plant.name}`}
                        className="metric w-28"
                        value={weights[plant.id] ?? ''}
                        onChange={(e) => setWeights((prev) => ({ ...prev, [plant.id]: e.target.value }))}
                        placeholder="0"
                      />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-muted">No alcanza a ninguna planta activa.</p>
            )}
          </FieldGroup>
        )}

        {needs.ambiente && (
          <>
            {needsSpace && ambiente && (
              <ChoiceOrSelect
                legend="¿A qué espacio se muda?"
                options={ambiente.spaces.map((space) => ({ value: space.id, label: space.name, icon: <Warehouse size={15} /> }))}
                value={spaceId}
                onChange={chooseSpace}
                size="sm"
              />
            )}

            {needsCycle && (
              <>
                <ChoiceGroup
                  legend={`¿A qué ciclo de ${destinationName} van las plantas sueltas?`}
                  hint={ambiente?.cycles.length ? undefined : `${destinationName} no tiene ciclos activos: se crea uno.`}
                  options={[
                    ...(ambiente?.cycles ?? []).map((cycle) => ({ value: cycle.id, label: cycle.name })),
                    { value: NEW_CYCLE, label: 'Ciclo nuevo', icon: <Plus size={15} /> },
                  ]}
                  value={cycleId}
                  onChange={setCycleId}
                  size="sm"
                />
                {cycleId === NEW_CYCLE && (
                  <Field label="Nombre del ciclo nuevo">
                    <Input type="text" autoComplete="off" value={newCycleName} onChange={(e) => setNewCycleName(e.target.value)} />
                  </Field>
                )}
              </>
            )}

            {contextError ? (
              <FormAlert tone="error">{contextError}</FormAlert>
            ) : destinationName ? (
              <p className="text-sm leading-relaxed text-fg-muted">
                Los ciclos y plantas que alcanza pasan a <strong className="text-fg">{destinationName}</strong>. Si elegiste todas las plantas de un ciclo, se muda el ciclo entero.
              </p>
            ) : !ambiente ? (
              <p className="flex items-center gap-2 text-sm text-fg-muted"><Loader2 size={15} className="animate-spin" aria-hidden="true" />Cargando destino…</p>
            ) : null}
          </>
        )}

        <p className="text-xs leading-snug text-fg-muted">
          Queda en la bitácora de cada planta. Si te equivocaste, desmarcala y se deshace.
        </p>
      </form>
    </Modal>
  )
}
