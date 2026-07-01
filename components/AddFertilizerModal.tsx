'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import { Fertilizer } from '@/app/lib/types'

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

  if (!isOpen) return null

  const handleAddWeek = () => {
    setDoseWeekly([...doseWeekly, { week: doseWeekly.length + 1, dose: 1 }])
  }

  const handleRemoveWeek = (index: number) => {
    const newWeekly = [...doseWeekly]
    newWeekly.splice(index, 1)
    // Re-index weeks
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
      setError('Por favor, completa el nombre y la marca.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const formData: Partial<Fertilizer> = {
      name,
      brand,
      stage,
      dose_type: doseType,
      dose_fixed: doseType === 'fija' ? parseFloat(doseFixed) || 0 : undefined,
      dose_weekly: doseType === 'semanal' ? doseWeekly : undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-[#12141C] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/80 dark:bg-[#12141C]/80 backdrop-blur z-10 p-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
          <h2 className="text-xl font-serif text-slate-800 dark:text-white font-bold">
            {initialData ? 'Editar Producto' : 'Agregar Producto'}
          </h2>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-white/5 rounded-full text-slate-600 dark:text-slate-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del Producto</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#F5F5F1] dark:bg-white/5 border-none focus:ring-2 focus:ring-brand-primary dark:text-white"
                placeholder="Ej. Top Candy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marca</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#F5F5F1] dark:bg-white/5 border-none focus:ring-2 focus:ring-brand-primary dark:text-white"
                placeholder="Ej. Top Crop"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Etapa Recomendada</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as any)}
                className="w-full p-3 rounded-xl bg-[#F5F5F1] dark:bg-white/5 border-none focus:ring-2 focus:ring-brand-primary dark:text-white appearance-none"
              >
                <option value="todo">Todo el ciclo</option>
                <option value="enraizamiento">Enraizamiento</option>
                <option value="vegetativo">Vegetativo</option>
                <option value="floracion">Floración</option>
                <option value="lavado">Lavado de Raíces</option>
              </select>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-white/5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Lógica de Dosificación</label>
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setDoseType('fija')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                    doseType === 'fija'
                      ? 'bg-brand-primary text-white font-medium'
                      : 'bg-[#F5F5F1] dark:bg-white/5 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Dosis Fija
                </button>
                <button
                  type="button"
                  onClick={() => setDoseType('semanal')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                    doseType === 'semanal'
                      ? 'bg-brand-primary text-white font-medium'
                      : 'bg-[#F5F5F1] dark:bg-white/5 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Tabla por Semanas
                </button>
              </div>

              {doseType === 'fija' ? (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Cantidad (ml por Litro de agua)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={doseFixed}
                    onChange={(e) => setDoseFixed(e.target.value)}
                    className="w-full p-3 rounded-xl bg-[#F5F5F1] dark:bg-white/5 border-none focus:ring-2 focus:ring-brand-primary dark:text-white"
                    placeholder="Ej. 2.0"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs text-slate-500 mb-1">Dosis (ml/L) por semana en su etapa</label>
                  {doseWeekly.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-sm text-slate-600 dark:text-slate-400 w-20">Semana {item.week}</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={item.dose}
                        onChange={(e) => handleWeeklyDoseChange(index, e.target.value)}
                        className="flex-1 p-2 rounded-lg bg-[#F5F5F1] dark:bg-white/5 border-none focus:ring-2 focus:ring-brand-primary dark:text-white"
                        placeholder="ml/L"
                      />
                      {doseWeekly.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveWeek(index)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddWeek}
                    className="w-full mt-2 py-2 flex items-center justify-center gap-2 text-brand-primary hover:bg-brand-primary/5 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus size={16} />
                    Agregar Semana
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl font-medium transition-colors flex justify-center items-center mt-6"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Guardar Producto'}
          </button>
        </form>
      </div>
    </div>
  )
}
