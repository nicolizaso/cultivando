'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { Fertilizer, FertilizerCombo } from '@/app/lib/types'
import Modal from '@/components/ui/Modal'

interface AddFertilizerComboModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<FertilizerCombo>) => Promise<any>
  availableProducts: Fertilizer[]
  initialData?: FertilizerCombo | null
}

export default function AddFertilizerComboModal({ isOpen, onClose, onSave, availableProducts, initialData }: AddFertilizerComboModalProps) {
  const [name, setName] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<{ fertilizer_id: number; name: string }[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      setName(initialData.name)
      setSelectedProducts(initialData.products || [])
    } else {
      setName('')
      setSelectedProducts([])
    }
    setError(null)
  }, [initialData, isOpen])

  const handleToggleProduct = (product: Fertilizer) => {
    const isSelected = selectedProducts.some(p => p.fertilizer_id === product.id)
    if (isSelected) {
      setSelectedProducts(selectedProducts.filter(p => p.fertilizer_id !== product.id))
    } else {
      setSelectedProducts([...selectedProducts, { fertilizer_id: product.id, name: product.name }])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) {
      setError('Completá el nombre del combo.')
      return
    }
    if (selectedProducts.length === 0) {
      setError('Elegí al menos un producto.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const formData: Partial<FertilizerCombo> = {
      name,
      products: selectedProducts,
    }

    const res = await onSave(formData)

    setIsSubmitting(false)
    if (res.error) {
      setError(res.error)
    } else {
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar combo' : 'Armar combo'}
      description="Un combo agrupa los productos que aplicás juntos."
      size="md"
      dismissOnBackdrop={false}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="combo-form"
            className="btn btn-primary"
            disabled={isSubmitting || selectedProducts.length === 0}
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {isSubmitting ? 'Guardando...' : 'Guardar combo'}
          </button>
        </>
      }
    >
      <form id="combo-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p className="field-error" role="alert">
            <AlertCircle size={14} aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="field">
          <label htmlFor="combo-name" className="field-label">Nombre del combo</label>
          <input
            id="combo-name"
            data-autofocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-input"
            placeholder="Ej: Pack floración Top Crop"
          />
        </div>

        <fieldset className="border-t border-line pt-5">
          <legend className="field-label mb-3">Productos incluidos</legend>

          {availableProducts.length === 0 ? (
            <p className="text-sm text-fg-muted">
              Todavía no hay productos cargados. Agregá productos antes de armar un combo.
            </p>
          ) : (
            <ul className="custom-scrollbar max-h-64 space-y-2 overflow-y-auto pr-1">
              {availableProducts.map(product => {
                const isSelected = selectedProducts.some(p => p.fertilizer_id === product.id)
                return (
                  <li key={product.id}>
                    {/* Checkbox real: operable con teclado y anunciado como casilla */}
                    <label
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-md)] border p-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--ring)] ${
                        isSelected
                          ? 'border-[color:var(--brand)] bg-brand-soft'
                          : 'border-line bg-surface-2 hover:border-line-strong'
                      }`}
                    >
                      <span className="min-w-0">
                        <span
                          className={`block truncate text-sm font-semibold ${
                            isSelected ? 'text-[color:var(--brand-text)]' : 'text-fg'
                          }`}
                        >
                          {product.name}
                        </span>
                        <span className="block truncate text-xs text-fg-muted">{product.brand}</span>
                      </span>

                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleProduct(product)}
                        className="sr-only"
                      />
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          isSelected
                            ? 'border-[color:var(--brand)] bg-brand text-[color:var(--brand-fg)]'
                            : 'border-line-strong'
                        }`}
                        aria-hidden="true"
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </fieldset>
      </form>
    </Modal>
  )
}
