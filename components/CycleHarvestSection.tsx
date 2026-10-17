'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Scale } from 'lucide-react'
import { saveCycleHarvests } from '@/app/actions/harvests'
import { cycleYield } from '@/app/lib/harvest'
import type { HarvestRow, SpaceSize } from '@/app/lib/harvest'
import { todayForInput } from '@/app/lib/dates'
import { useToast } from '@/app/context/ToastContext'
import Modal from '@/components/ui/Modal'

interface CyclePlant {
  id: number
  name: string
  stage: string | null
  is_archived: boolean | null
}

interface CycleHarvestSectionProps {
  cycleId: number
  plants: CyclePlant[]
  harvests: HarvestRow[]
  space: SpaceSize | null
}

const fmt = (value: number | null, unit: string, decimals = 1) =>
  value === null ? '–' : `${value.toLocaleString('es-AR', { maximumFractionDigits: decimals })} ${unit}`

/**
 * Cosecha del ciclo: lo que rindió (seco total, por planta, por m² y por
 * watt) y una planilla para cargar los pesos de todas las plantas juntas.
 */
export default function CycleHarvestSection({ cycleId, plants, harvests, space }: CycleHarvestSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const candidates = plants.filter((plant) => !plant.is_archived || harvests.some((h) => h.plant_id === plant.id))
  const inFlowerOrLater = candidates.some((plant) => ['Floración', 'Secado', 'Curado'].includes(String(plant.stage)))
  if (harvests.length === 0 && !inFlowerOrLater) return null

  const yieldData = cycleYield(harvests, space)

  return (
    <section aria-labelledby="cosecha-ciclo" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="cosecha-ciclo" className="section-title">Cosecha</h2>
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => setIsOpen(true)}>
          <Scale size={15} aria-hidden="true" />
          Cargar pesos
        </button>
      </div>

      {harvests.length > 0 ? (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="surface rounded-[var(--radius-lg)] p-4 sm:p-5">
            <dt className="metric-label">Seco total</dt>
            <dd className="metric mt-2 text-3xl text-fg">{fmt(yieldData.dryTotal, 'g')}</dd>
            <dd className="mt-1 text-xs text-fg-subtle">
              {yieldData.dryCount} de {yieldData.harvested} {yieldData.harvested === 1 ? 'planta pesada' : 'plantas pesadas'} en seco
            </dd>
          </div>
          <div className="surface rounded-[var(--radius-lg)] p-4 sm:p-5">
            <dt className="metric-label">Por planta</dt>
            <dd className="metric mt-2 text-3xl text-fg">{fmt(yieldData.dryPerPlant, 'g')}</dd>
            <dd className="mt-1 text-xs text-fg-subtle">
              {yieldData.dryRatio !== null ? `Quedó el ${Math.round(yieldData.dryRatio * 100)}% del húmedo` : 'Promedio en seco'}
            </dd>
          </div>
          <div className="surface rounded-[var(--radius-lg)] p-4 sm:p-5">
            <dt className="metric-label">Por m²</dt>
            <dd className="metric mt-2 text-3xl text-fg">{fmt(yieldData.perSquareMeter, 'g')}</dd>
            <dd className="mt-1 text-xs text-fg-subtle">{yieldData.perSquareMeter === null ? 'Cargá las medidas del espacio' : 'Según el espacio'}</dd>
          </div>
          <div className="surface rounded-[var(--radius-lg)] p-4 sm:p-5">
            <dt className="metric-label">Por watt</dt>
            <dd className="metric mt-2 text-3xl text-fg">{fmt(yieldData.perWatt, 'g/W', 2)}</dd>
            <dd className="mt-1 text-xs text-fg-subtle">{yieldData.perWatt === null ? 'Cargá la potencia de la luz' : 'Según la luz del espacio'}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-fg-muted">Cuando cortes, cargá el peso húmedo de cada planta; al terminar el secado, el seco.</p>
      )}

      {isOpen && (
        <HarvestSheet cycleId={cycleId} plants={candidates} harvests={harvests} onClose={() => setIsOpen(false)} />
      )}
    </section>
  )
}

function HarvestSheet({ cycleId, plants, harvests, onClose }: { cycleId: number; plants: CyclePlant[]; harvests: HarvestRow[]; onClose: () => void }) {
  const router = useRouter()
  const { showToast } = useToast()
  const byPlant = new Map(harvests.map((h) => [h.plant_id, h]))
  const [date, setDate] = useState(todayForInput)
  const [rows, setRows] = useState(() =>
    Object.fromEntries(
      plants.map((plant) => {
        const h = byPlant.get(plant.id)
        return [plant.id, { wet_g: h?.wet_g != null ? String(h.wet_g) : '', dry_g: h?.dry_g != null ? String(h.dry_g) : '' }]
      })
    ) as Record<number, { wet_g: string; dry_g: string }>
  )
  const [moveToDrying, setMoveToDrying] = useState(true)
  const [saving, setSaving] = useState(false)

  const set = (plantId: number, field: 'wet_g' | 'dry_g', value: string) =>
    setRows((prev) => ({ ...prev, [plantId]: { ...prev[plantId], [field]: value } }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    const res = await saveCycleHarvests(
      cycleId,
      plants.map((plant) => ({ plant_id: plant.id, ...rows[plant.id] })),
      date,
      { moveToDrying }
    )
    setSaving(false)
    if (res.error) {
      showToast(res.error, 'error')
      return
    }
    showToast(`Pesos guardados de ${res.saved} ${res.saved === 1 ? 'planta' : 'plantas'}`)
    router.refresh()
    onClose()
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Cargar pesos de la cosecha"
      description="Dejá vacío lo que todavía no pesaste."
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" form="harvest-sheet" className="btn btn-primary" disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            Guardar pesos
          </button>
        </>
      }
    >
      <form id="harvest-sheet" onSubmit={submit} className="space-y-4">
        <div className="field max-w-[12rem]">
          <label htmlFor="sheet-date" className="field-label">Cosechadas el</label>
          <input id="sheet-date" type="date" required className="field-input" value={date} onChange={(e) => setDate(e.target.value)} />
          <p className="field-hint">Para las que todavía no tenían cosecha.</p>
        </div>

        <table className="w-full text-sm">
          <thead className="text-left text-xs text-fg-muted">
            <tr>
              <th scope="col" className="py-2 pr-3 font-semibold">Planta</th>
              <th scope="col" className="w-28 py-2 pr-3 font-semibold">Húmedo (g)</th>
              <th scope="col" className="w-28 py-2 font-semibold">Seco (g)</th>
            </tr>
          </thead>
          <tbody>
            {plants.map((plant) => (
              <tr key={plant.id} className="border-t border-line">
                <th scope="row" className="py-2 pr-3 text-left font-medium text-fg">{plant.name}</th>
                <td className="py-2 pr-3">
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label={`Peso húmedo de ${plant.name}`}
                    className="field-input py-1.5"
                    value={rows[plant.id]?.wet_g ?? ''}
                    onChange={(e) => set(plant.id, 'wet_g', e.target.value)}
                  />
                </td>
                <td className="py-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label={`Peso seco de ${plant.name}`}
                    className="field-input py-1.5"
                    value={rows[plant.id]?.dry_g ?? ''}
                    onChange={(e) => set(plant.id, 'dry_g', e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" className="h-4 w-4 accent-[color:var(--brand)]" checked={moveToDrying} onChange={(e) => setMoveToDrying(e.target.checked)} />
          Pasar a Secado las plantas que se pesen y todavía estén en floración
        </label>
      </form>
    </Modal>
  )
}
