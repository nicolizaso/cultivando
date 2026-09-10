'use client'

import { useEffect, useState } from 'react'
import { FlaskConical, Layers, Pencil, Plus, Trash2 } from 'lucide-react'

import AddFertilizerModal from '@/components/AddFertilizerModal'
import AddFertilizerComboModal from '@/components/AddFertilizerComboModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/EmptyState'
import PageShell from '@/components/layout/PageShell'
import PageHeader from '@/components/layout/PageHeader'
import SegmentedControl from '@/components/ui/SegmentedControl'
import {
  getFertilizers, getFertilizerCombos, createFertilizer, updateFertilizer, deleteFertilizer,
  createFertilizerCombo, deleteFertilizerCombo, updateFertilizerCombo
} from '@/app/actions/fertilizers'
import { Fertilizer, FertilizerCombo } from '@/app/lib/types'

type Tab = 'productos' | 'combos'

type PendingDeletion =
  | { kind: 'product'; id: number; name: string }
  | { kind: 'combo'; id: number; name: string }

const STAGE_LABELS: Record<string, string> = {
  todo: 'Todo el ciclo',
  enraizamiento: 'Enraizamiento',
  vegetativo: 'Vegetativo',
  floracion: 'Floración',
  lavado: 'Lavado de raíces',
}

export default function FertilizersPage() {
  const [activeTab, setActiveTab] = useState<Tab>('productos')
  const [fertilizers, setFertilizers] = useState<Fertilizer[]>([])
  const [combos, setCombos] = useState<FertilizerCombo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isComboModalOpen, setIsComboModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Fertilizer | null>(null)
  const [editingCombo, setEditingCombo] = useState<FertilizerCombo | null>(null)
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null)

  const loadData = async () => {
    setIsLoading(true)
    const [fertRes, comboRes] = await Promise.all([
      getFertilizers(),
      getFertilizerCombos()
    ])
    if (fertRes.data) setFertilizers(fertRes.data)
    if (comboRes.data) setCombos(comboRes.data)
    setIsLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSaveProduct = async (data: Partial<Fertilizer>) => {
    const res = editingProduct
      ? await updateFertilizer(editingProduct.id, data)
      : await createFertilizer(data)

    if (res && res.error) return res

    await loadData()
    return { error: null }
  }

  const handleSaveCombo = async (data: Partial<FertilizerCombo>) => {
    const res = editingCombo
      ? await updateFertilizerCombo(editingCombo.id, data)
      : await createFertilizerCombo(data)

    if (res && res.error) return res

    await loadData()
    return { error: null }
  }

  const handleConfirmDelete = async () => {
    if (!pendingDeletion) return
    if (pendingDeletion.kind === 'product') await deleteFertilizer(pendingDeletion.id)
    else await deleteFertilizerCombo(pendingDeletion.id)
    await loadData()
  }

  const openProductModal = () => { setEditingProduct(null); setIsProductModalOpen(true) }
  const openComboModal = () => { setEditingCombo(null); setIsComboModalOpen(true) }

  return (
    // La navegación la pone el layout: renderizarla acá duplicaba las barras.
    <PageShell>
      <PageHeader
        title="Nutrición"
        subtitle="Tus fertilizantes y los combos que aplicás juntos"
        actions={
          activeTab === 'productos' ? (
            <button type="button" onClick={openProductModal} className="btn btn-primary">
              <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
              Nuevo producto
            </button>
          ) : (
            <button type="button" onClick={openComboModal} className="btn btn-primary">
              <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
              Nuevo combo
            </button>
          )
        }
      />

      <div className="mb-5">
        <SegmentedControl<Tab>
          label="Secciones de nutrición"
          variant="tabs"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'productos', label: 'Productos', icon: FlaskConical, count: fertilizers.length },
            { value: 'combos', label: 'Combos', icon: Layers, count: combos.length },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Cargando">
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton h-44 rounded-[var(--radius-lg)]" />
          ))}
        </div>
      ) : activeTab === 'productos' ? (
        <section id="panel-productos" role="tabpanel" aria-labelledby="tab-productos">
          {fertilizers.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="Todavía no hay productos"
              description="Cargá los fertilizantes que usás con su dosis y su etapa. Después, al agendar un riego, la app calcula los mililitros por litro sola."
              action={
                <button type="button" onClick={openProductModal} className="btn btn-primary">
                  <Plus size={18} aria-hidden="true" />
                  Nuevo producto
                </button>
              }
            />
          ) : (
            <ul className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {fertilizers.map((fert, i) => (
                <li
                  key={fert.id}
                  style={{ ['--i' as string]: i }}
                  className="surface flex flex-col rounded-[var(--radius-lg)] p-5"
                >
                  <div className="mb-4 flex items-start gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--accent-green-soft)] text-[color:var(--accent-green)]"
                      aria-hidden="true"
                    >
                      <FlaskConical size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-fg">{fert.name}</h3>
                      <p className="truncate text-xs text-fg-muted">{fert.brand || 'Sin marca'}</p>
                    </div>
                  </div>

                  <dl className="mb-4 flex flex-wrap gap-2">
                    <div>
                      <dt className="sr-only">Etapa</dt>
                      <dd className="chip chip-neutral">{STAGE_LABELS[fert.stage] ?? fert.stage}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Dosis</dt>
                      <dd className="chip chip-brand">
                        {fert.dose_type === 'fija' ? `${fert.dose_fixed} ml/L` : 'Tabla por semanas'}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-auto flex justify-end gap-1 border-t border-line pt-3">
                    <button
                      type="button"
                      onClick={() => { setEditingProduct(fert); setIsProductModalOpen(true); }}
                      className="btn-icon btn-icon-sm"
                      aria-label={`Editar ${fert.name}`}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeletion({ kind: 'product', id: fert.id, name: fert.name })}
                      className="btn-icon btn-icon-sm text-[color:var(--danger)]"
                      aria-label={`Eliminar ${fert.name}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section id="panel-combos" role="tabpanel" aria-labelledby="tab-combos">
          {combos.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Todavía no hay combos"
              description="Un combo agrupa los productos que aplicás en el mismo riego, para agendarlos de una sola vez en lugar de cargarlos uno por uno."
              action={
                <button type="button" onClick={openComboModal} className="btn btn-primary">
                  <Plus size={18} aria-hidden="true" />
                  Nuevo combo
                </button>
              }
            />
          ) : (
            <ul className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {combos.map((combo, i) => (
                <li
                  key={combo.id}
                  style={{ ['--i' as string]: i }}
                  className="surface flex flex-col rounded-[var(--radius-lg)] p-5"
                >
                  <div className="mb-4 flex items-start gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--accent-violet-soft)] text-[color:var(--accent-violet)]"
                      aria-hidden="true"
                    >
                      <Layers size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-fg">{combo.name}</h3>
                      <p className="text-xs text-fg-muted">
                        {combo.products?.length || 0} producto{combo.products?.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <ul className="mb-4 flex flex-wrap gap-2">
                    {combo.products?.map((p, idx) => (
                      <li key={idx} className="chip chip-neutral">{p.name}</li>
                    ))}
                  </ul>

                  <div className="mt-auto flex justify-end gap-1 border-t border-line pt-3">
                    <button
                      type="button"
                      onClick={() => { setEditingCombo(combo); setIsComboModalOpen(true); }}
                      className="btn-icon btn-icon-sm"
                      aria-label={`Editar ${combo.name}`}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeletion({ kind: 'combo', id: combo.id, name: combo.name })}
                      className="btn-icon btn-icon-sm text-[color:var(--danger)]"
                      aria-label={`Eliminar ${combo.name}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <AddFertilizerModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveProduct}
        initialData={editingProduct}
      />

      <AddFertilizerComboModal
        isOpen={isComboModalOpen}
        onClose={() => setIsComboModalOpen(false)}
        onSave={handleSaveCombo}
        availableProducts={fertilizers}
        initialData={editingCombo}
      />

      <ConfirmDialog
        isOpen={!!pendingDeletion}
        onClose={() => setPendingDeletion(null)}
        onConfirm={handleConfirmDelete}
        title={pendingDeletion?.kind === 'combo' ? 'Eliminar combo' : 'Eliminar producto'}
        description={`Se eliminará "${pendingDeletion?.name ?? ''}". Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
      />
    </PageShell>
  )
}
