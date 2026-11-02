'use client'

import { useRef, useState } from 'react'
import { Package, Plus, Trash2 } from 'lucide-react'
import { Fertilizer } from '@/app/lib/types'
import type { FertilizerStage } from '@/app/lib/nutrition'
import Modal from '@/components/ui/Modal'
import { getStageColor } from '@/app/lib/utils'
import {
  ChoiceGroup, Field, FieldGroup, FormActions, FormAlert, FormSection, Input, Switch, useFieldErrors,
} from '@/components/ui/form'
import type { ChoiceOption } from '@/components/ui/form'

const stageChoice = (value: FertilizerStage, label: string, stageName?: string): ChoiceOption<FertilizerStage> => {
  const style = stageName ? getStageColor(stageName) : null
  return { value, label, icon: style?.icon, accent: style?.accent }
}

const STAGE_CHOICES: ChoiceOption<FertilizerStage>[] = [
  stageChoice('todo', 'Todo el ciclo'),
  stageChoice('enraizamiento', 'Enraizamiento', 'Enraizamiento'),
  stageChoice('vegetativo', 'Vegetativo', 'Vegetativo'),
  stageChoice('floracion', 'Floración', 'Floración'),
  { value: 'lavado', label: 'Lavado de raíces' },
]

interface AddFertilizerModalProps {
  isOpen: boolean
  onClose: () => void
  /** Lo que escribió el usuario; el servidor valida y convierte los números. */
  onSave: (data: Record<string, unknown>) => Promise<{ error?: string | null }>
  initialData?: Fertilizer | null
}

export default function AddFertilizerModal({ isOpen, onClose, onSave, initialData }: AddFertilizerModalProps) {
  // El formulario arranca con los datos del producto (o en blanco). Quien lo
  // abre le cambia la `key` en cada apertura, así que no hace falta un efecto
  // que copie props al estado. Se leen las columnas reales: antes se leían
  // `stage`, `dose_type` y `dose_fixed`, que no existen.
  const [name, setName] = useState(initialData?.name ?? '')
  const [brand, setBrand] = useState(initialData?.brand ?? '')
  const [stage, setStage] = useState<FertilizerStage>(initialData?.stage_category ?? 'todo')
  const [doseType, setDoseType] = useState<'fija' | 'semanal'>(initialData?.dosage_type ?? 'fija')
  const [doseFixed, setDoseFixed] = useState(
    initialData?.fixed_dosage != null ? String(initialData.fixed_dosage).replace('.', ',') : ''
  )
  const [doseWeekly, setDoseWeekly] = useState<{ week: number; dose: number; text?: string }[]>(
    initialData?.weekly_dosages?.length ? initialData.weekly_dosages : [{ week: 1, dose: 1 }]
  )
  // Stock (opcional): cuánto queda, tamaño del envase y desde cuánto avisar.
  const toText = (value: number | null | undefined) => (value == null ? '' : String(value).replace('.', ','))
  const [stock, setStock] = useState(toText(initialData?.stock_ml))
  const [container, setContainer] = useState(toText(initialData?.container_ml))
  const [lowStock, setLowStock] = useState(toText(initialData?.low_stock_ml))
  const [trackStock, setTrackStock] = useState(
    initialData?.stock_ml != null || initialData?.container_ml != null || initialData?.low_stock_ml != null
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const { errors, validate, clear } = useFieldErrors<'name' | 'dose'>()

  // La semana nueva arranca con la dosis de la anterior: casi siempre sube
  // de a poco, y es más fácil corregir un número que escribirlo de cero.
  const handleAddWeek = () => {
    const last = doseWeekly[doseWeekly.length - 1]?.dose ?? 1
    setDoseWeekly([...doseWeekly, { week: doseWeekly.length + 1, dose: last, text: undefined }])
  }

  const handleRemoveWeek = (index: number) => {
    const newWeekly = [...doseWeekly]
    newWeekly.splice(index, 1)
    setDoseWeekly(newWeekly.map((item, i) => ({ ...item, week: i + 1 })))
  }

  const handleWeeklyDoseChange = (index: number, value: string) => {
    const newWeekly = [...doseWeekly]
    // Se guarda también lo escrito: si no, "1," se volvía "1" al tipear y no
    // había forma de cargar un decimal.
    newWeekly[index] = { ...newWeekly[index], dose: parseFloat(value.replace(',', '.')) || 0, text: value }
    setDoseWeekly(newWeekly)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = validate({
      name: !name.trim() && 'Ponele un nombre al producto.',
      dose: doseType === 'fija' && !doseFixed.trim() && 'Cargá cuántos ml van por litro.',
    }, formRef.current)
    if (!ok) return

    setIsSubmitting(true)
    setError(null)

    // Los nombres de campo son los de las columnas reales de la base.
    const formData: Record<string, unknown> = {
      name: name.trim(),
      brand: brand.trim() || null,
      stage_category: stage,
      dosage_type: doseType,
      fixed_dosage: doseType === 'fija' ? Number(doseFixed.replace(',', '.')) : null,
      weekly_dosages: doseType === 'semanal' ? doseWeekly.map(({ week, dose }) => ({ week, dose })) : null,
      // Vacío = no llevar la cuenta. El servidor valida los números.
      stock_ml: trackStock ? stock.trim() || null : null,
      container_ml: trackStock ? container.trim() || null : null,
      low_stock_ml: trackStock ? lowStock.trim() || null : null,
    }

    const res = await onSave(formData)

    setIsSubmitting(false)
    if (res.error) {
      setError(res.error)
    } else {
      onClose()
    }
  }

  const doseOptions: Array<{ value: 'fija' | 'semanal'; label: string }> = [
    { value: 'fija', label: 'Siempre igual' },
    { value: 'semanal', label: 'Cambia por semana' },
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar producto' : 'Nuevo producto'}
      description="Su dosis por litro, para calcular cada riego."
      dismissOnBackdrop={false}
      footer={
        <FormActions
          form="fertilizer-form"
          onCancel={onClose}
          pending={isSubmitting}
          submitLabel={initialData ? 'Guardar cambios' : 'Agregar producto'}
        />
      }
    >
      <form id="fertilizer-form" ref={formRef} onSubmit={handleSubmit} className="space-y-6" noValidate>
        {error && <FormAlert>{error}</FormAlert>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre" error={errors.name}>
            <Input
              data-autofocus
              type="text"
              autoComplete="off"
              value={name}
              onChange={(e) => { setName(e.target.value); clear('name') }}
              placeholder="Ej: Top Candy"
            />
          </Field>
          <Field label="Marca" optional>
            <Input
              type="text"
              autoComplete="off"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Ej: Top Crop"
            />
          </Field>
        </div>

        <ChoiceGroup
          legend="Para qué etapa"
          options={STAGE_CHOICES}
          value={stage}
          onChange={setStage}
          size="sm"
        />

        <FormSection title="Dosis">
          <ChoiceGroup
            legend="Cómo se dosifica"
            hideLegend
            variant="segment"
            options={doseOptions}
            value={doseType}
            onChange={(value) => { setDoseType(value); clear('dose') }}
          />

          {doseType === 'fija' ? (
            <Field label="Por litro de agua" error={errors.dose}>
              <Input
                type="text"
                inputMode="decimal"
                suffix="ml/L"
                className="metric text-lg"
                value={doseFixed}
                onChange={(e) => { setDoseFixed(e.target.value); clear('dose') }}
                placeholder="2"
              />
            </Field>
          ) : (
            <FieldGroup legend="Por litro, en cada semana de la etapa">
              <ol className="space-y-2">
                {doseWeekly.map((item, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <label htmlFor={`fert-week-${index}`} className="w-20 shrink-0 text-sm font-semibold text-fg-muted">
                      Semana {item.week}
                    </label>
                    <div className="min-w-0 flex-1">
                      <Input
                        id={`fert-week-${index}`}
                        type="text"
                        inputMode="decimal"
                        suffix="ml/L"
                        value={item.text ?? String(item.dose).replace('.', ',')}
                        onChange={(e) => handleWeeklyDoseChange(index, e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveWeek(index)}
                      disabled={doseWeekly.length <= 1}
                      className="btn-icon shrink-0 hover:text-[color:var(--danger)]"
                      aria-label={`Quitar semana ${item.week}`}
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ol>
              <button type="button" onClick={handleAddWeek} className="btn btn-secondary w-full">
                <Plus size={16} aria-hidden="true" />
                Agregar semana {doseWeekly.length + 1}
              </button>
            </FieldGroup>
          )}
        </FormSection>

        <FormSection title="Stock">
          <Switch
            checked={trackStock}
            onChange={setTrackStock}
            icon={<Package size={17} />}
            label="Llevar la cuenta de lo que queda"
            description="Cada riego con la calculadora lo descuenta solo y avisa cuando queda poco."
          />
          {trackStock && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 animate-fade-in">
              <Field label="Queda">
                <Input type="text" inputMode="decimal" suffix="ml" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="500" />
              </Field>
              <Field label="Envase">
                <Input type="text" inputMode="decimal" suffix="ml" value={container} onChange={(e) => setContainer(e.target.value)} placeholder="1000" />
              </Field>
              <Field label="Avisar con" className="col-span-2 sm:col-span-1">
                <Input type="text" inputMode="decimal" suffix="ml" value={lowStock} onChange={(e) => setLowStock(e.target.value)} placeholder="100" />
              </Field>
            </div>
          )}
        </FormSection>
      </form>
    </Modal>
  )
}
