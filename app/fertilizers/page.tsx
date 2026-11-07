'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, FlaskConical, Layers, Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { Field, FormActions, Input } from '@/components/ui/form'

import AddFertilizerModal from '@/components/AddFertilizerModal'
import AddFertilizerComboModal from '@/components/AddFertilizerComboModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/EmptyState'
import PageShell from '@/components/layout/PageShell'
import PageHeader from '@/components/layout/PageHeader'
import SegmentedControl from '@/components/ui/SegmentedControl'
import {
  getFertilizers, getFertilizerCombos, createFertilizer, updateFertilizer, deleteFertilizer,
  createFertilizerCombo, deleteFertilizerCombo, updateFertilizerCombo, restockFertilizer
} from '@/app/actions/fertilizers'
import { Fertilizer, FertilizerCombo } from '@/app/lib/types'
import { FERTILIZER_STAGE_LABELS, doseUnitLabel, formatDose, formatDoseWithUnit } from '@/app/lib/nutrition'
import { useToast } from '@/app/context/ToastContext'

type Tab = 'productos' | 'combos'

type PendingDeletion =
  | { kind: 'product'; id: number; name: string }
  | { kind: 'combo'; id: number; name: string }

export default function FertilizersPage() {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>('productos')
  const [fertilizers, setFertilizers] = useState<Fertilizer[]>([])
  const [combos, setCombos] = useState<FertilizerCombo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isComboModalOpen, setIsComboModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Fertilizer | null>(null)
  const [editingCombo, setEditingCombo] = useState<FertilizerCombo | null>(null)
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null)
  const [restocking, setRestocking] = useState<Fertilizer | null>(null)

  // Cada apertura de un modal le da una `key` nueva: el formulario se arma de
  // cero con los datos del producto o combo elegido, sin copiar props al
  // estado en un efecto.
  const [productFormKey, setProductFormKey] = useState(0)
  const [comboFormKey, setComboFormKey] = useState(0)

  const loadData = async () => {
    const [fertRes, comboRes] = await Promise.all([
      getFertilizers(),
      getFertilizerCombos()
    ])
    if (fertRes.data) setFertilizers(fertRes.data)
    if (comboRes.data) setCombos(comboRes.data)
    setIsLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([getFertilizers(), getFertilizerCombos()]).then(([fertRes, comboRes]) => {
      if (cancelled) return
      if (fertRes.data) setFertilizers(fertRes.data)
      if (comboRes.data) setCombos(comboRes.data)
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const handleSaveProduct = async (data: Record<string, unknown>) => {
    const res = editingProduct
      ? await updateFertilizer(editingProduct.id, data)
      : await createFertilizer(data)

    if (res && res.error) return res

    await loadData()
    return { error: null }
  }

  const handleSaveCombo = async (data: Record<string, unknown>) => {
    const res = editingCombo
      ? await updateFertilizerCombo(editingCombo.id, data)
      : await createFertilizerCombo(data)

    if (res && res.error) return res

    await loadData()
    return { error: null }
  }

  const handleConfirmDelete = async () => {
    if (!pendingDeletion) return
    // Antes el error se tragaba y parecía que se había borrado.
    const res = pendingDeletion.kind === 'product'
      ? await deleteFertilizer(pendingDeletion.id)
      : await deleteFertilizerCombo(pendingDeletion.id)
    if (res?.error) showToast(res.error, 'error')
    await loadData()
  }

  const editProduct = (product: Fertilizer | null) => {
    setEditingProduct(product)
    setProductFormKey((key) => key + 1)
    setIsProductModalOpen(true)
  }
  const editCombo = (combo: FertilizerCombo | null) => {
    setEditingCombo(combo)
    setComboFormKey((key) => key + 1)
    setIsComboModalOpen(true)
  }
  const openProductModal = () => editProduct(null)
  const openComboModal = () => editCombo(null)

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
                      <dd className="chip chip-neutral">{fert.stage_category ? FERTILIZER_STAGE_LABELS[fert.stage_category] : 'Sin etapa'}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Dosis</dt>
                      <dd className="chip chip-brand">
                        {fert.dosage_type === 'semanal'
                          ? `Tabla de ${fert.weekly_dosages?.length ?? 0} semana${fert.weekly_dosages?.length === 1 ? '' : 's'} · ${doseUnitLabel(fert.unit, fert.dose_basis)}`
                          : fert.fixed_dosage === null ? 'Sin dosis' : formatDoseWithUnit(fert.fixed_dosage, fert.unit, fert.dose_basis)}
                      </dd>
                    </div>
                  </dl>

                  {fert.stock_ml !== null && <StockMeter fertilizer={fert} />}

                  <div className="mt-auto flex justify-end gap-1 border-t border-line pt-3">
                    <button
                      type="button"
                      onClick={() => setRestocking(fert)}
                      className="btn btn-sm btn-ghost mr-auto"
                    >
                      <ShoppingCart size={15} aria-hidden="true" />
                      Compré
                    </button>
                    <button
                      type="button"
                      onClick={() => editProduct(fert)}
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
                    {combo.products?.map((p) => {
                      const product = fertilizers.find((f) => f.id === p.fertilizer_id)
                      return (
                        <li key={p.fertilizer_id} className={p.dose === null ? 'chip chip-neutral' : 'chip chip-brand'}>
                          {p.name}
                          {p.dose !== null && product && (
                            <span className="mono font-semibold">
                              {' · '}{formatDoseWithUnit(p.dose, product.unit, product.dose_basis)}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>

                  {combo.description && (
                    <p className="mb-4 line-clamp-3 text-sm text-fg-muted">{combo.description}</p>
                  )}

                  <div className="mt-auto flex justify-end gap-1 border-t border-line pt-3">
                    <button
                      type="button"
                      onClick={() => editCombo(combo)}
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

      {restocking && (
        <RestockDialog
          key={restocking.id}
          fertilizer={restocking}
          onClose={() => setRestocking(null)}
          onDone={async () => {
            setRestocking(null)
            await loadData()
          }}
        />
      )}

      <AddFertilizerModal
        key={productFormKey}
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveProduct}
        initialData={editingProduct}
      />

      <AddFertilizerComboModal
        key={comboFormKey}
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

/** Cuánto queda: número, barra contra el envase y aviso si está bajo. */
function StockMeter({ fertilizer }: { fertilizer: Fertilizer }) {
  const stock = fertilizer.stock_ml ?? 0
  const low = fertilizer.low_stock_ml !== null && stock <= fertilizer.low_stock_ml
  const capacity = Math.max(fertilizer.container_ml ?? 0, stock)
  const ratio = capacity > 0 ? Math.min(1, stock / capacity) : null

  return (
    <div className="mb-4">
      <p className="text-sm text-fg-muted">
        Quedan <span className="mono font-semibold text-fg">{formatDose(stock)} {fertilizer.unit}</span>
        {fertilizer.container_ml !== null && <> de un envase de {formatDose(fertilizer.container_ml)} {fertilizer.unit}</>}
      </p>
      {ratio !== null && (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--chart-band)]"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={capacity}
          aria-valuenow={stock}
          aria-label={`Stock de ${fertilizer.name}`}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: low ? 'var(--warning)' : 'var(--chart-line)' }}
          />
        </div>
      )}
      {low && (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[color:var(--warning)]">
          <AlertTriangle size={13} aria-hidden="true" />
          Queda poco
        </p>
      )}
    </div>
  )
}

/** "Compré": suma un envase o la cantidad que se diga. */
function RestockDialog({ fertilizer, onClose, onDone }: { fertilizer: Fertilizer; onClose: () => void; onDone: () => Promise<void> }) {
  const [ml, setMl] = useState(fertilizer.container_ml !== null ? String(fertilizer.container_ml) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const res = await restockFertilizer(fertilizer.id, ml)
    setSaving(false)
    if (res.error) {
      setError(res.error)
      return
    }
    await onDone()
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Compré ${fertilizer.name}`}
      description={fertilizer.stock_ml === null ? 'Desde ahora se lleva la cuenta de este producto.' : `Hoy quedan ${formatDose(fertilizer.stock_ml)} ${fertilizer.unit}.`}
      size="sm"
      footer={
        <FormActions form="restock-form" onCancel={onClose} icon={ShoppingCart} pending={saving} submitLabel="Sumar al stock" />
      }
    >
      <form id="restock-form" onSubmit={save} className="space-y-4" noValidate>
        <Field
          label="Cuánto compraste"
          error={error}
          below={
            fertilizer.container_ml !== null && fertilizer.container_ml > 0 ? (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Envases">
                {[1, 2, 3].map((n) => {
                  const amount = String(fertilizer.container_ml! * n)
                  return (
                    <button key={n} type="button" className="choice choice-sm" aria-pressed={ml === amount} onClick={() => setMl(amount)}>
                      {n === 1 ? '1 envase' : `${n} envases`}
                    </button>
                  )
                })}
              </div>
            ) : undefined
          }
        >
          <Input data-autofocus type="text" inputMode="decimal" suffix={fertilizer.unit} className="metric text-lg" value={ml} onChange={(e) => setMl(e.target.value)} placeholder="1000" />
        </Field>
      </form>
    </Modal>
  )
}
