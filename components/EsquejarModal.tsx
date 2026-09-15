'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GitBranch, Loader2, Minus, Plus, Search } from 'lucide-react'
import { completeEsquejado, getEsquejadoCandidates } from '@/app/actions/tasks'
import { describeCloneBatch, MAX_CLONES_PER_MOTHER } from '@/app/lib/clones'
import type { CloneEntry } from '@/app/lib/clones'
import type { EsquejadoMetadata, Task } from '@/app/lib/types'
import { useToast } from '@/app/context/ToastContext'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import DatePicker from './DatePicker'

interface Candidate {
  id: number
  name: string
  strain?: string | null
  stage?: string | null
  cycle_id?: number | null
}

interface Cycle {
  id: number
  name: string
  space_id?: number
}

interface EsquejarModalProps {
  isOpen: boolean
  onClose: () => void
  task: Task
}

const NEW_CYCLE = '__new__'

/**
 * Se abre al marcar completada una tarea de "Esquejado".
 *
 * La tarea se agenda sobre un ciclo entero porque al agendarla no se sabe de
 * qué plantas van a salir esquejes ni cuántos: eso se responde acá, con la
 * tarea ya hecha en vivo. Cada esqueje nace como planta nueva, día 0 en
 * Enraizamiento.
 */
export default function EsquejarModal({ isOpen, onClose, task }: EsquejarModalProps) {
  const router = useRouter()
  const { showToast } = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [spaces, setSpaces] = useState<{ id: number; name: string }[]>([])
  const [alreadyRegistered, setAlreadyRegistered] = useState<EsquejadoMetadata | null>(null)

  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [query, setQuery] = useState('')
  const [cycleChoice, setCycleChoice] = useState<string>('')
  const [newCycleName, setNewCycleName] = useState('')
  const [newCycleSpaceId, setNewCycleSpaceId] = useState<number | ''>('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showZeroConfirm, setShowZeroConfirm] = useState(false)

  // El modal se monta recién al abrirse (AgendaList lo renderiza sólo cuando hay
  // tarea), así que el estado inicial ya es el de una tanda limpia y acá sólo
  // queda traer las plantas que la tarea alcanza.
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    getEsquejadoCandidates(task.id).then((res) => {
      if (cancelled) return

      if ('error' in res && res.error) {
        setLoadError(res.error)
      } else {
        setCandidates(res.candidates ?? [])
        setCycles(res.cycles ?? [])
        setSpaces(res.spaces ?? [])
        setAlreadyRegistered(res.alreadyRegistered ?? null)
        setCycleChoice(res.defaultCycleId ? String(res.defaultCycleId) : '')

        const today = new Date()
        setNewCycleName(
          `Esquejes ${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`
        )

        const originCycle = res.cycles?.find((c: Cycle) => c.id === res.defaultCycleId)
        setNewCycleSpaceId(originCycle?.space_id ?? res.spaces?.[0]?.id ?? '')
      }

      setIsLoading(false)
    })

    return () => { cancelled = true }
  }, [isOpen, task.id])

  const entries: CloneEntry[] = useMemo(
    () =>
      Object.entries(counts)
        .map(([motherId, count]) => ({ motherId: Number(motherId), count }))
        .filter((entry) => entry.count > 0),
    [counts]
  )

  const total = entries.reduce((sum, entry) => sum + entry.count, 0)

  const visibleCandidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter(
      (plant) =>
        plant.name?.toLowerCase().includes(q) || plant.strain?.toLowerCase().includes(q)
    )
  }, [candidates, query])

  const bump = (plantId: number, delta: number) => {
    setCounts((prev) => {
      const next = Math.min(MAX_CLONES_PER_MOTHER, Math.max(0, (prev[plantId] ?? 0) + delta))
      return { ...prev, [plantId]: next }
    })
  }

  const setCount = (plantId: number, value: string) => {
    const parsed = Math.floor(Number(value))
    const next = Number.isFinite(parsed)
      ? Math.min(MAX_CLONES_PER_MOTHER, Math.max(0, parsed))
      : 0
    setCounts((prev) => ({ ...prev, [plantId]: next }))
  }

  const save = async () => {
    setIsSubmitting(true)

    const creatingCycle = cycleChoice === NEW_CYCLE
    const res = await completeEsquejado(task.id, {
      date,
      entries,
      targetCycleId: creatingCycle ? null : cycleChoice ? Number(cycleChoice) : null,
      newCycle: creatingCycle ? { name: newCycleName, spaceId: Number(newCycleSpaceId) } : null,
    })

    setIsSubmitting(false)

    if ('error' in res && res.error) {
      showToast(res.error, 'error')
      return
    }

    const created = res.created ?? 0
    const cycleName = 'cycleName' in res ? res.cycleName : null

    showToast(
      created > 0
        ? `${created === 1 ? '1 esqueje creado' : `${created} esquejes creados`}${cycleName ? ` en ${cycleName}` : ''}`
        : 'Tarea completada',
      'success'
    )
    router.refresh()
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (total === 0) {
      setShowZeroConfirm(true)
      return
    }

    if (cycleChoice === NEW_CYCLE) {
      if (!newCycleName.trim()) return showToast('Ponele un nombre al ciclo nuevo.', 'error')
      if (!newCycleSpaceId) return showToast('Elegí en qué espacio va el ciclo nuevo.', 'error')
    } else if (!cycleChoice) {
      return showToast('Elegí a qué ciclo van los esquejes.', 'error')
    }

    save()
  }

  const footer = alreadyRegistered ? (
    <>
      <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button type="button" className="btn btn-primary" onClick={save} disabled={isSubmitting}>
        {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        Marcar completada
      </button>
    </>
  ) : (
    <>
      <span className="mr-auto text-sm text-fg-muted" role="status">
        {describeCloneBatch(entries)}
      </span>
      <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button type="submit" form="esquejar-form" className="btn btn-primary" disabled={isSubmitting || isLoading}>
        {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        {total > 0 ? `Crear ${total} ${total === 1 ? 'esqueje' : 'esquejes'}` : 'Completar tarea'}
      </button>
    </>
  )

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Registrar esquejado"
        description="De qué plantas sacaste esquejes y cuántos de cada una."
        size="xl"
        dismissOnBackdrop={false}
        footer={footer}
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-fg-muted">
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            Buscando las plantas de la tarea...
          </div>
        ) : loadError ? (
          <p className="py-8 text-center text-sm text-[color:var(--danger)]" role="alert">{loadError}</p>
        ) : alreadyRegistered ? (
          <div className="space-y-3">
            <p className="text-sm text-fg-muted">
              {alreadyRegistered.total > 0
                ? 'Esta tarea ya tiene esquejes registrados. Volver a completarla no crea plantas nuevas.'
                : 'Esta tarea ya se había completado sin registrar esquejes.'}
            </p>
            <ul className="space-y-2">
              {alreadyRegistered.entries.map((entry) => (
                <li
                  key={entry.mother_id}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-line bg-surface-2 px-3 py-2 text-sm"
                >
                  <span className="truncate text-fg">{entry.mother_name ?? `Planta #${entry.mother_id}`}</span>
                  <span className="mono text-fg-muted">{entry.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : candidates.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg-muted">
            La tarea no alcanza ninguna planta activa. Editala para apuntarla a un ciclo con plantas.
          </p>
        ) : (
          <form id="esquejar-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="field">
              <label htmlFor="esquejado-date" className="field-label">Fecha del corte</label>
              <DatePicker id="esquejado-date" selectedDate={date} onChange={setDate} />
              <p className="field-hint">Es el día 0 de los esquejes: nacen en Enraizamiento con esta fecha.</p>
            </div>

            <fieldset className="field">
              <legend className="field-label mb-2">Plantas madre</legend>

              {candidates.length > 6 && (
                <div className="relative mb-3">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-fg-muted"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por nombre o genética"
                    aria-label="Buscar entre las plantas de la tarea"
                    className="field-input pl-10"
                  />
                </div>
              )}

              <ul className="space-y-2">
                {visibleCandidates.map((plant) => {
                  const count = counts[plant.id] ?? 0
                  return (
                    <li
                      key={plant.id}
                      className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-2 transition-colors ${
                        count > 0
                          ? 'border-[color:color-mix(in_srgb,var(--brand)_40%,transparent)] bg-brand-soft'
                          : 'border-line bg-surface-2'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-fg">{plant.name}</p>
                        <p className="truncate text-xs text-fg-muted">
                          {[plant.strain, plant.stage].filter(Boolean).join(' · ') || 'Sin genética'}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          className="btn-icon-sm"
                          onClick={() => bump(plant.id, -1)}
                          disabled={count === 0}
                          aria-label={`Un esqueje menos de ${plant.name}`}
                        >
                          <Minus size={16} aria-hidden="true" />
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={MAX_CLONES_PER_MOTHER}
                          value={count}
                          onChange={(e) => setCount(plant.id, e.target.value)}
                          aria-label={`Esquejes de ${plant.name}`}
                          className="field-input mono w-16 px-2 text-center"
                        />
                        <button
                          type="button"
                          className="btn-icon-sm"
                          onClick={() => bump(plant.id, 1)}
                          aria-label={`Un esqueje más de ${plant.name}`}
                        >
                          <Plus size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>

              {visibleCandidates.length === 0 && (
                <p className="py-4 text-center text-sm text-fg-muted">Ninguna planta coincide con la búsqueda.</p>
              )}
            </fieldset>

            <div className="space-y-3 rounded-[var(--radius-lg)] border border-line bg-surface-2 p-4">
              <div className="field">
                <label htmlFor="esquejado-cycle" className="field-label">Ciclo destino</label>
                <select
                  id="esquejado-cycle"
                  value={cycleChoice}
                  onChange={(e) => setCycleChoice(e.target.value)}
                  className="field-input"
                >
                  <option value="">Seleccionar ciclo...</option>
                  {cycles.map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
                  ))}
                  <option value={NEW_CYCLE}>+ Crear ciclo nuevo</option>
                </select>
                <p className="field-hint">Los esquejes se crean como plantas de este ciclo.</p>
              </div>

              {cycleChoice === NEW_CYCLE && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="field">
                    <label htmlFor="esquejado-new-cycle" className="field-label">Nombre del ciclo</label>
                    <input
                      id="esquejado-new-cycle"
                      type="text"
                      value={newCycleName}
                      onChange={(e) => setNewCycleName(e.target.value)}
                      className="field-input"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="esquejado-new-space" className="field-label">Espacio</label>
                    <select
                      id="esquejado-new-space"
                      value={newCycleSpaceId}
                      onChange={(e) => setNewCycleSpaceId(e.target.value ? Number(e.target.value) : '')}
                      className="field-input"
                    >
                      <option value="">Seleccionar espacio...</option>
                      {spaces.map((space) => (
                        <option key={space.id} value={space.id}>{space.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <p className="flex items-center gap-2 text-xs text-fg-muted">
              <GitBranch size={14} aria-hidden="true" />
              Cada esqueje hereda genética, banco y madre de la planta de la que sale.
            </p>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showZeroConfirm}
        onClose={() => setShowZeroConfirm(false)}
        onConfirm={save}
        title="Completar sin esquejes"
        description="No cargaste ningún esqueje, así que no se va a crear ninguna planta. ¿Completar igual la tarea?"
        confirmLabel="Completar"
        tone="brand"
      />
    </>
  )
}
