'use client'

import { useRef, useState } from 'react'
import { Fertilizer, FertilizerCombo } from '@/app/lib/types'
import Modal from '@/components/ui/Modal'
import { Field, FormActions, FormAlert, Input, MultiChoice, useFieldErrors } from '@/components/ui/form'

interface AddFertilizerComboModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<FertilizerCombo>) => Promise<{ error?: string | null }>
  availableProducts: Fertilizer[]
  initialData?: FertilizerCombo | null
}

export default function AddFertilizerComboModal({ isOpen, onClose, onSave, availableProducts, initialData }: AddFertilizerComboModalProps) {
  // Quien lo abre le cambia la `key` en cada apertura: el estado arranca con
  // el combo elegido (o en blanco) sin un efecto que copie props.
  const [name, setName] = useState(initialData?.name ?? '')
  const [selectedProducts, setSelectedProducts] = useState<{ fertilizer_id: number; name: string }[]>(initialData?.products ?? [])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const { errors, validate, clear } = useFieldErrors<'name' | 'products'>()

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
    const ok = validate({
      name: !name.trim() && 'Ponele un nombre al combo.',
      products: selectedProducts.length === 0 && 'Elegí al menos un producto.',
    }, formRef.current)
    if (!ok) return

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
      title={initialData ? 'Editar combo' : 'Nuevo combo'}
      description="Los productos que aplicás juntos en el mismo riego."
      dismissOnBackdrop={false}
      footer={
        <FormActions
          form="combo-form"
          onCancel={onClose}
          pending={isSubmitting}
          submitLabel={initialData ? 'Guardar cambios' : 'Crear combo'}
          status={selectedProducts.length > 0 ? `${selectedProducts.length} ${selectedProducts.length === 1 ? 'producto' : 'productos'}` : undefined}
        />
      }
    >
      <form id="combo-form" ref={formRef} onSubmit={handleSubmit} className="space-y-6" noValidate>
        {error && <FormAlert>{error}</FormAlert>}

        <Field label="Nombre" error={errors.name}>
          <Input
            data-autofocus
            type="text"
            autoComplete="off"
            value={name}
            onChange={(e) => { setName(e.target.value); clear('name') }}
            placeholder="Ej: Floración Top Crop"
          />
        </Field>

        {availableProducts.length === 0 ? (
          <FormAlert tone="info">
            Todavía no hay productos cargados. Agregá productos antes de armar un combo.
          </FormAlert>
        ) : (
          <MultiChoice
            legend="Qué lleva"
            variant="tile"
            layout="grid grid-cols-1 gap-2 sm:grid-cols-2"
            options={availableProducts.map(product => ({
              value: product.id,
              label: product.name,
              description: product.brand || undefined,
            }))}
            values={selectedProducts.map(p => p.fertilizer_id)}
            onToggle={(id) => {
              const product = availableProducts.find(p => p.id === id)
              if (product) { handleToggleProduct(product); clear('products') }
            }}
            error={errors.products}
          />
        )}
      </form>
    </Modal>
  )
}
