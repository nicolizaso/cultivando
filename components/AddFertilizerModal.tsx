'use client'

import { useState } from 'react'
import { AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react'
import { Fertilizer } from '@/app/lib/types'
import type { FertilizerStage } from '@/app/lib/nutrition'
import Modal from '@/components/ui/Modal'

interface AddFertilizerModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<Fertilizer>) => Promise<{ error?: string | null }>
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
  const [doseWeekly, setDoseWeekly] = useState<{ week: number; dose: number }[]>(
    initialData?.weekly_dosages?.length ? initialData.weekly_dosages : [{ week: 1, dose: 1 }]
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAddWeek = () => {
    setDoseWeekly([...doseWeekly, { week: doseWeekly.length + 1, dose: 1 }])
  }

  const handleRemoveWeek = (index: number) => {
    const newWeekly = [...doseWeekly]
    newWeekly.splice(index, 1)
    setDoseWeekly(newWeekly.map((item, i) => ({ ...item, week: i + 1 })))
  }

  const handleWeeklyDoseChange = (index: number, value: string) => {
    const newWeekly = [...doseWeekly]
    newWeekly[index].dose = parseFloat(value) || 0
    setDoseWeekly(newWeekly)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Completá el nombre del producto.')
      return
    }
    if (doseType === 'fija' && !doseFixed.trim()) {
      setError('Cargá la dosis en ml por litro.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    // Los nombres de campo son los de las columnas reales de la base.
    const formData: Partial<Fertilizer> = {
      name: name.trim(),
      brand: brand.trim() || null,
      stage_category: stage,
      dosage_type: doseType,
      fixed_dosage: doseType === 'fija' ? Number(doseFixed.replace(',', '.')) : null,
      weekly_dosages: doseType === 'semanal' ? doseWeekly : null,
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
    { value: 'fija', label: 'Dosis fija' },
    { value: 'semanal', label: 'Tabla por semanas' },
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar producto' : 'Agregar producto'}
      size="md"
      dismissOnBackdrop={false}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="fertilizer-form" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {isSubmitting ? 'Guardando...' : 'Guardar producto'}
          </button>
        </>
      }
    >
      <form id="fertilizer-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p className="field-error" role="alert">
            <AlertCircle size={14} aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="field">
          <label htmlFor="fert-name" className="field-label">Nombre del producto</label>
          <input
            id="fert-name"
            data-autofocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-input"
            placeholder="Ej: Top Candy"
          />
        </div>

        <div className="field">
          <label htmlFor="fert-brand" className="field-label">Marca</label>
          <input
            id="fert-brand"
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="field-input"
            placeholder="Ej: Top Crop"
          />
        </div>

        <div className="field">
          <label htmlFor="fert-stage" className="field-label">Etapa recomendada</label>
          <select
            id="fert-stage"
            value={stage}
            onChange={(e) => setStage(e.target.value as FertilizerStage)}
            className="field-input"
          >
            <option value="todo">Todo el ciclo</option>
            <option value="enraizamiento">Enraizamiento</option>
            <option value="vegetativo">Vegetativo</option>
            <option value="floracion">Floración</option>
            <option value="lavado">Lavado de raíces</option>
          </select>
        </div>

        <fieldset className="border-t border-line pt-5">
          <legend className="field-label mb-3">Lógica de dosificación</legend>

          <div className="mb-4 flex gap-2 rounded-[var(--radius-md)] border border-line bg-surface-2 p-1">
            {doseOptions.map((option) => {
              const checked = doseType === option.value
              return (
                <label
                  key={option.value}
                  className={`flex flex-1 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] px-3 py-2 text-sm font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--ring)] ${
                    checked ? 'bg-brand text-[color:var(--brand-fg)]' : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  <input
                    type="radio"
                    name="dose_type"
                    value={option.value}
                    checked={checked}
                    onChange={() => setDoseType(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              )
            })}
          </div>

          {doseType === 'fija' ? (
            <div className="field">
              <label htmlFor="fert-dose-fixed" className="field-label">Cantidad (ml por litro)</label>
              <input
                id="fert-dose-fixed"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={doseFixed}
                onChange={(e) => setDoseFixed(e.target.value)}
                className="field-input"
                placeholder="Ej: 2.0"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="field-hint">Dosis en ml por litro para cada semana de la etapa.</p>

              {doseWeekly.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <label htmlFor={`fert-week-${index}`} className="w-24 shrink-0 text-sm text-fg-muted">
                    Semana {item.week}
                  </label>
                  <input
                    id={`fert-week-${index}`}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={item.dose}
                    onChange={(e) => handleWeeklyDoseChange(index, e.target.value)}
                    className="field-input flex-1"
                    placeholder="ml/L"
                  />
                  {doseWeekly.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveWeek(index)}
                      className="btn-icon shrink-0 text-[color:var(--danger)]"
                      aria-label={`Quitar semana ${item.week}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}

              <button type="button" onClick={handleAddWeek} className="btn btn-secondary w-full">
                <Plus size={16} aria-hidden="true" />
                Agregar semana
              </button>
            </div>
          )}
        </fieldset>
      </form>
    </Modal>
  )
}
