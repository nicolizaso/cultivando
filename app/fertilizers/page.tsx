'use client'

import { useState, useEffect } from 'react'
import { Plus, FlaskConical, Layers, Pencil, Trash2 } from 'lucide-react'
import AddFertilizerModal from '@/components/AddFertilizerModal'
import AddFertilizerComboModal from '@/components/AddFertilizerComboModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/EmptyState'
import { getFertilizers, getFertilizerCombos, createFertilizer, updateFertilizer, deleteFertilizer, createFertilizerCombo, deleteFertilizerCombo, updateFertilizerCombo } from '@/app/actions/fertilizers'
import { Fertilizer, FertilizerCombo } from '@/app/lib/types'

type PendingDeletion =
  | { kind: 'product'; id: number; name: string }
  | { kind: 'combo'; id: number; name: string }

export default function FertilizersPage() {
  const [activeTab, setActiveTab] = useState<'productos' | 'combos'>('productos')
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
    let res;
    if (editingProduct) {
      res = await updateFertilizer(editingProduct.id, data)
    } else {
      res = await createFertilizer(data)
    }

    if (res && res.error) {
      return res;
    }

    await loadData()
    return { error: null }
  }

  const handleSaveCombo = async (data: Partial<FertilizerCombo>) => {
    let res;
    if (editingCombo) {
      res = await updateFertilizerCombo(editingCombo.id, data)
    } else {
      res = await createFertilizerCombo(data)
    }
    if (res && res.error) {
      return res;
    }
    await loadData()
    return { error: null }
  }

  const handleConfirmDelete = async () => {
    if (!pendingDeletion) return
    if (pendingDeletion.kind === 'product') {
      await deleteFertilizer(pendingDeletion.id)
    } else {
      await deleteFertilizerCombo(pendingDeletion.id)
    }
    await loadData()
  }

  const stageLabels: Record<string, string> = {
    todo: 'Todo el ciclo',
    enraizamiento: 'Enraizamiento',
    vegetativo: 'Vegetativo',
    floracion: 'Floración',
    lavado: 'Lavado de raíces'
  }

  const tabs: Array<{ id: 'productos' | 'combos'; label: string }> = [
    { id: 'productos', label: 'Productos' },
    { id: 'combos', label: 'Combos' },
  ]

  return (
    // La barra superior y la inferior las pone el layout: renderizarlas aquí
    // duplicaba ambas navegaciones en esta página.
    <main className="mx-auto w-full max-w-5xl px-5 py-6 md:px-8 md:py-8">
      <header className="mb-8">
        <h1 className="font-title text-2xl font-semibold tracking-tight text-fg md:text-[28px]">Nutrición</h1>
        <p className="mt-1 text-sm text-fg-muted">Gestioná tus fertilizantes y armá tus combos nutricionales.</p>
      </header>

      <div role="tablist" aria-label="Secciones de nutrición" className="mb-6 flex gap-6 border-b border-line">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'border-[color:var(--brand)] text-[color:var(--brand-text)]'
                : 'border-transparent text-fg-muted hover:text-fg'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Cargando">
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton h-40 rounded-[var(--radius-lg)]" />
          ))}
        </div>
      ) : activeTab === 'productos' ? (
        <section id="panel-productos" role="tabpanel" aria-labelledby="tab-productos" className="space-y-5">
          <button
            type="button"
            onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }}
            className="btn btn-primary"
          >
            <Plus size={18} aria-hidden="true" />
            Agregar producto
          </button>

          {fertilizers.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="Sin productos"
              description="Cargá los fertilizantes que usás para calcular las dosis automáticamente al agendar tareas."
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {fertilizers.map(fert => (
                <li key={fert.id} className="surface flex flex-col rounded-[var(--radius-lg)] p-5">
                  <div className="mb-3 flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[color:var(--brand-text)]" aria-hidden="true">
                      <FlaskConical size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-fg">{fert.name}</h3>
                      <p className="truncate text-xs text-fg-muted">{fert.brand}</p>
                    </div>
                  </div>

                  <dl className="space-y-1 text-sm text-fg-muted">
                    <div className="flex gap-1.5">
                      <dt className="font-medium text-fg">Etapa:</dt>
                      <dd>{stageLabels[fert.stage]}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="font-medium text-fg">Dosis:</dt>
                      <dd>{fert.dose_type === 'fija' ? `${fert.dose_fixed} ml/L` : 'Tabla por semanas'}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex justify-end gap-1 border-t border-line pt-3">
                    <button
                      type="button"
                      onClick={() => { setEditingProduct(fert); setIsProductModalOpen(true); }}
                      className="btn-icon h-9 min-h-9 w-9 min-w-9"
                      aria-label={`Editar ${fert.name}`}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeletion({ kind: 'product', id: fert.id, name: fert.name })}
                      className="btn-icon h-9 min-h-9 w-9 min-w-9 text-[color:var(--danger)]"
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
        <section id="panel-combos" role="tabpanel" aria-labelledby="tab-combos" className="space-y-5">
          <button
            type="button"
            onClick={() => { setEditingCombo(null); setIsComboModalOpen(true); }}
            className="btn btn-primary"
          >
            <Plus size={18} aria-hidden="true" />
            Armar combo
          </button>

          {combos.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Sin combos"
              description="Un combo agrupa los productos que aplicás juntos, para agendarlos de una sola vez."
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {combos.map(combo => (
                <li key={combo.id} className="surface flex flex-col rounded-[var(--radius-lg)] p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[color:var(--brand-text)]" aria-hidden="true">
                      <Layers size={18} />
                    </span>
                    <h3 className="min-w-0 flex-1 truncate font-semibold text-fg">{combo.name}</h3>
                  </div>

                  <p className="mb-2 text-xs font-medium text-fg-muted">
                    {combo.products?.length || 0} productos
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {combo.products?.map((p, idx) => (
                      <li key={idx} className="chip border-line bg-surface-2 text-fg-muted">{p.name}</li>
                    ))}
                  </ul>

                  <div className="mt-4 flex justify-end gap-1 border-t border-line pt-3">
                    <button
                      type="button"
                      onClick={() => { setEditingCombo(combo); setIsComboModalOpen(true); }}
                      className="btn-icon h-9 min-h-9 w-9 min-w-9"
                      aria-label={`Editar ${combo.name}`}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeletion({ kind: 'combo', id: combo.id, name: combo.name })}
                      className="btn-icon h-9 min-h-9 w-9 min-w-9 text-[color:var(--danger)]"
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
    </main>
  )
}
