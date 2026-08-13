'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react'
import { Fertilizer } from '@/app/lib/types'
import Modal from '@/components/ui/Modal'

interface AddFertilizerModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<Fertilizer>) => Promise<any>
  initialData?: Fertilizer | null
}

export default function AddFertilizerModal({ isOpen, onClose, onSave, initialData }: AddFertilizerModalProps) {
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [stage, setStage] = useState<'enraizamiento' | 'vegetativo' | 'floracion' | 'lavado' | 'todo'>('todo')
  const [doseType, setDoseType] = useState<'fija' | 'semanal'>('fija')
  const [doseFixed, setDoseFixed] = useState('')
  const [doseWeekly, setDoseWeekly] = useState<{ week: number; dose: number }[]>([{ week: 1, dose: 1 }])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      setName(initialData.name)
      setBrand(initialData.brand)
      setStage(initialData.stage)
      setDoseType(initialData.dose_type)
      setDoseFixed(initialData.dose_fixed ? initialData.dose_fixed.toString() : '')
      setDoseWeekly(initialData.dose_weekly || [{ week: 1, dose: 1 }])
    } else {
      setName('')
      setBrand('')
      setStage('todo')
      setDoseType('fija')
      setDoseFixed('')
      setDoseWeekly([{ week: 1, dose: 1 }])
    }
    setError(null)
  }, [initialData, isOpen])

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
    if (!name || !brand) {
      setError('Completá el nombre y la marca del producto.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    // Los nombres de campo son los de las columnas reales de la base.
    const formData: any = {
      name: name.trim(),
      brand: brand.trim(),
      stage_category: stage,
      dosage_type: doseType,
    }

    if (doseType === 'fija') {
      formData.fixed_dosage = parseFloat(doseFixed.toString().replace(',', '.')) || 0;
      formData.weekly_dosages = null;
    } else {
      formData.fixed_dosage = null;
      formData.weekly_dosages = doseWeekly;
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
            onChange={(e) => setStage(e.target.value as any)}
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
