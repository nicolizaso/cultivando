'use client'

import { useRef, useState } from 'react'
import { Fertilizer, FertilizerCombo } from '@/app/lib/types'
import { doseUnitShort, formatDose, productDoseText } from '@/app/lib/nutrition'
import Modal from '@/components/ui/Modal'
import { Field, FieldGroup, FormActions, FormAlert, Input, MultiChoice, Textarea, useFieldErrors } from '@/components/ui/form'

interface AddFertilizerComboModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Record<string, unknown>) => Promise<{ error?: string | null }>
  availableProducts: Fertilizer[]
  initialData?: FertilizerCombo | null
}

export default function AddFertilizerComboModal({ isOpen, onClose, onSave, availableProducts, initialData }: AddFertilizerComboModalProps) {
  // Quien lo abre le cambia la `key` en cada apertura: el estado arranca con
  // el combo elegido (o en blanco) sin un efecto que copie props.
  const [name, setName] = useState(initialData?.name ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [selected, setSelected] = useState<number[]>(initialData?.products.map((p) => p.fertilizer_id) ?? [])
  // La dosis propia de cada producto en este combo, como texto ("" = la del producto).
  const [doses, setDoses] = useState<Record<number, string>>(() =>
    Object.fromEntries((initialData?.products ?? []).map((p) => [p.fertilizer_id, p.dose === null ? '' : formatDose(p.dose)]))
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const { errors, validate, clear } = useFieldErrors<'name' | 'products'>()

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]))
    clear('products')
  }

  const selectedProducts = selected
    .map((id) => availableProducts.find((product) => product.id === id))
    .filter((product): product is Fertilizer => Boolean(product))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = validate({
      name: !name.trim() && 'Ponele un nombre al combo.',
      products: selectedProducts.length === 0 && 'Elegí al menos un producto.',
    }, formRef.current)
    if (!ok) return

    setIsSubmitting(true)
    setError(null)

    const res = await onSave({
      name: name.trim(),
      description: description.trim() || null,
      // El servidor entiende "1,5" y valida el rango.
      items: selectedProducts.map((product) => ({ fertilizer_id: product.id, dose: doses[product.id]?.trim() || null })),
    })

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
            options={availableProducts.map((product) => ({
              value: product.id,
              label: product.name,
              description: [product.brand, productDoseText(product)].filter(Boolean).join(' · '),
            }))}
            values={selected}
            onToggle={toggle}
            error={errors.products}
          />
        )}

        {selectedProducts.length > 0 && (
          <FieldGroup
            legend="Dosis en este combo"
            optional
            hint="Vacío: va con la dosis del producto. Escribí otra si en este combo la usás distinta."
          >
            <ul className="space-y-2">
              {selectedProducts.map((product) => (
                <li key={product.id} className="flex items-center gap-3">
                  <label htmlFor={`combo-dose-${product.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
                    {product.name}
                  </label>
                  <div className="w-36 shrink-0">
                    <Input
                      id={`combo-dose-${product.id}`}
                      type="text"
                      inputMode="decimal"
                      suffix={doseUnitShort(product.unit, product.dose_basis)}
                      value={doses[product.id] ?? ''}
                      onChange={(e) => setDoses((prev) => ({ ...prev, [product.id]: e.target.value }))}
                      placeholder={product.dosage_type === 'semanal' ? 'tabla' : product.fixed_dosage === null ? '–' : formatDose(product.fixed_dosage)}
                      aria-label={`Dosis de ${product.name} en este combo`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </FieldGroup>
        )}

        <Field label="Notas" optional>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: agitar antes, primero el A y después el B"
            rows={2}
          />
        </Field>
      </form>
    </Modal>
  )
}
