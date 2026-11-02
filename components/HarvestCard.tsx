'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Scale, Star, Trash2 } from 'lucide-react'
import { deleteHarvest, saveHarvest } from '@/app/actions/harvests'
import type { HarvestRow } from '@/app/lib/harvest'
import { formatDay, todayForInput } from '@/app/lib/dates'
import { useToast } from '@/app/context/ToastContext'
import Modal from '@/components/ui/Modal'
import { DateField, Field, FormActions, FormSection, Input, Rating, Switch, Textarea } from '@/components/ui/form'

const HARVESTABLE = new Set(['Floración', 'Secado', 'Curado', 'Cosechada'])

const grams = (value: number | null | undefined) =>
  value == null ? '–' : `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })} g`

interface HarvestCardProps {
  plantId: number
  plantName: string
  stage: string
  harvest: HarvestRow | null
}

/** Cosecha de la planta en su ficha: los pesos, o el botón para cargarlos. */
export default function HarvestCard({ plantId, plantName, stage, harvest }: HarvestCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  if (!harvest && !HARVESTABLE.has(stage)) return null

  return (
    <section aria-labelledby="cosecha" className="mx-auto mb-10 max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-2.5 border-b border-line pb-4">
        <h2 id="cosecha" className="section-title flex items-center gap-2.5">
          <Scale className="text-[color:var(--brand-text)]" size={18} aria-hidden="true" />
          Cosecha
        </h2>
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => setIsOpen(true)}>
          {harvest ? <Pencil size={15} aria-hidden="true" /> : <Scale size={15} aria-hidden="true" />}
          {harvest ? 'Editar' : 'Registrar cosecha'}
        </button>
      </div>

      {harvest ? (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="surface rounded-[var(--radius-lg)] p-4">
            <dt className="metric-label">Húmedo</dt>
            <dd className="metric mt-1.5 text-xl text-fg">{grams(harvest.wet_g)}</dd>
            <dd className="mt-0.5 text-xs text-fg-muted">{formatDay(harvest.harvested_on)}</dd>
          </div>
          <div className="surface rounded-[var(--radius-lg)] p-4">
            <dt className="metric-label">Seco</dt>
            <dd className="metric mt-1.5 text-xl text-fg">{grams(harvest.dry_g)}</dd>
            <dd className="mt-0.5 text-xs text-fg-muted">{harvest.dried_on ? formatDay(harvest.dried_on) : 'Secando'}</dd>
          </div>
          <div className="surface rounded-[var(--radius-lg)] p-4">
            <dt className="metric-label">Merma</dt>
            <dd className="metric mt-1.5 text-xl text-fg">
              {harvest.wet_g && harvest.dry_g != null ? `${Math.round((1 - harvest.dry_g / harvest.wet_g) * 100)}%` : '–'}
            </dd>
            <dd className="mt-0.5 text-xs text-fg-muted">del peso al secar</dd>
          </div>
          <div className="surface rounded-[var(--radius-lg)] p-4">
            <dt className="metric-label">Calificación</dt>
            <dd className="mt-2 flex gap-0.5" aria-label={harvest.rating ? `${harvest.rating} de 5` : 'Sin calificar'}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={16}
                  aria-hidden="true"
                  className={harvest.rating && n <= harvest.rating ? 'fill-[color:var(--accent-amber)] text-[color:var(--accent-amber)]' : 'text-fg-subtle'}
                />
              ))}
            </dd>
          </div>
          {harvest.notes && <p className="col-span-full text-sm text-fg-muted">{harvest.notes}</p>}
        </dl>
      ) : (
        <p className="text-sm text-fg-muted">Cuando la cortes, anotá el peso húmedo; al terminar el secado, el seco.</p>
      )}

      {isOpen && (
        <HarvestForm
          plantId={plantId}
          plantName={plantName}
          stage={stage}
          harvest={harvest}
          onClose={() => setIsOpen(false)}
        />
      )}
    </section>
  )
}

function HarvestForm({ plantId, plantName, stage, harvest, onClose }: HarvestCardProps & { onClose: () => void }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [values, setValues] = useState({
    harvested_on: harvest?.harvested_on ?? todayForInput(),
    dried_on: harvest?.dried_on ?? '',
    wet_g: harvest?.wet_g != null ? String(harvest.wet_g).replace('.', ',') : '',
    dry_g: harvest?.dry_g != null ? String(harvest.dry_g).replace('.', ',') : '',
    rating: harvest?.rating ? String(harvest.rating) : '',
    notes: harvest?.notes ?? '',
  })
  const [moveToDrying, setMoveToDrying] = useState(stage === 'Floración')
  const [saving, setSaving] = useState(false)

  const set = (field: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((prev) => ({ ...prev, [field]: event.target.value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    const res = await saveHarvest(plantId, values, { moveToDrying })
    setSaving(false)
    if (res.error) {
      showToast(res.error, 'error')
      return
    }
    showToast(moveToDrying ? `Cosecha guardada. ${plantName} pasó a Secado.` : 'Cosecha guardada')
    router.refresh()
    onClose()
  }

  const remove = async () => {
    setSaving(true)
    const res = await deleteHarvest(plantId)
    setSaving(false)
    if (res.error) {
      showToast(res.error, 'error')
      return
    }
    showToast('Cosecha borrada')
    router.refresh()
    onClose()
  }

  const wet = Number(values.wet_g.replace(',', '.'))
  const dry = Number(values.dry_g.replace(',', '.'))
  const loss = wet > 0 && dry > 0 && dry <= wet ? Math.round((1 - dry / wet) * 100) : null

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={harvest ? 'Editar cosecha' : 'Registrar cosecha'}
      description={plantName}
      footer={
        <FormActions
          form="harvest-form"
          onCancel={onClose}
          pending={saving}
          submitLabel="Guardar cosecha"
          extra={
            harvest ? (
              <button type="button" className="btn btn-danger" onClick={remove} disabled={saving} aria-label="Borrar cosecha">
                <Trash2 size={16} aria-hidden="true" />
                <span className="hidden sm:inline">Borrar</span>
              </button>
            ) : undefined
          }
        />
      }
    >
      <form id="harvest-form" onSubmit={submit} className="space-y-6">
        <FormSection title="El corte">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DateField
              label="Cosechada"
              value={values.harvested_on}
              onChange={(v) => setValues((prev) => ({ ...prev, harvested_on: v }))}
              required
            />
            <Field label="Peso húmedo" optional>
              <Input data-autofocus type="text" inputMode="decimal" suffix="g" className="metric text-lg" value={values.wet_g} onChange={set('wet_g')} placeholder="420" />
            </Field>
          </div>
          {stage === 'Floración' && (
            <Switch
              checked={moveToDrying}
              onChange={setMoveToDrying}
              label="Pasar la planta a Secado"
              description="Con la fecha de cosecha como inicio del secado."
            />
          )}
        </FormSection>

        <FormSection title="Después del secado" description="Completalo cuando termine; podés volver a editar.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DateField
              label="Terminó de secar"
              optional
              quick="none"
              value={values.dried_on}
              onChange={(v) => setValues((prev) => ({ ...prev, dried_on: v }))}
            />
            <Field label="Peso seco" optional hint={loss !== null ? `Perdió el ${loss}% al secar.` : undefined}>
              <Input type="text" inputMode="decimal" suffix="g" className="metric text-lg" value={values.dry_g} onChange={set('dry_g')} placeholder="95" />
            </Field>
          </div>
          <Rating
            legend="Calificación"
            optional
            value={Number(values.rating) || 0}
            onChange={(n) => setValues((prev) => ({ ...prev, rating: n ? String(n) : '' }))}
          />
          <Field label="Notas" optional>
            <Textarea value={values.notes} onChange={set('notes')} placeholder="Aroma, densidad, tricomas…" />
          </Field>
        </FormSection>
      </form>
    </Modal>
  )
}
