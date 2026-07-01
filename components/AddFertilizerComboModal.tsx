'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Plus, Trash2, Check } from 'lucide-react'
import { Fertilizer, FertilizerCombo } from '@/app/lib/types'

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

  if (!isOpen) return null

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
      setError('Por favor, completa el nombre del combo.')
      return
    }
    if (selectedProducts.length === 0) {
      setError('Por favor, selecciona al menos un producto.')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-[#12141C] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/80 dark:bg-[#12141C]/80 backdrop-blur z-10 p-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
          <h2 className="text-xl font-serif text-slate-800 dark:text-white font-bold">
            {initialData ? 'Editar Combo' : 'Armar Combo'}
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del Combo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#F5F5F1] dark:bg-white/5 border-none focus:ring-2 focus:ring-brand-primary dark:text-white"
                placeholder="Ej. Pack Flora Top Crop"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-white/5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Productos Incluidos</label>

              <div className="space-y-2 max-h-60 overflow-y-auto p-1">
                {availableProducts.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No hay productos disponibles. Agrega productos primero.</p>
                ) : (
                  availableProducts.map(product => {
                    const isSelected = selectedProducts.some(p => p.fertilizer_id === product.id)
                    return (
                      <div
                        key={product.id}
                        onClick={() => handleToggleProduct(product)}
                        className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors border ${
                          isSelected
                            ? 'bg-brand-primary/10 border-brand-primary/30 dark:border-brand-primary/50'
                            : 'bg-[#F5F5F1] dark:bg-white/5 border-transparent hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <p className={`font-medium text-sm ${isSelected ? 'text-brand-primary' : 'text-slate-800 dark:text-white'}`}>
                            {product.name}
                          </p>
                          <p className="text-xs text-slate-500">{product.brand}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected ? 'bg-brand-primary border-brand-primary' : 'border-slate-300 dark:border-slate-600'
                        }`}>
                          {isSelected && <Check size={12} className="text-white" />}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || selectedProducts.length === 0}
            className="w-full py-3 bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-50 text-white rounded-xl font-medium transition-colors flex justify-center items-center mt-6"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Guardar Combo'}
          </button>
        </form>
      </div>
    </div>
  )
}
