'use client'

import { useState, useEffect } from 'react'
import { Plus, FlaskConical, Layers, Edit2, Trash2 } from 'lucide-react'
import DesktopNavbar from '@/components/DesktopNavbar'
import BottomNav from '@/components/BottomNav'
import AddFertilizerModal from '@/components/AddFertilizerModal'
import AddFertilizerComboModal from '@/components/AddFertilizerComboModal'
import { getFertilizers, getFertilizerCombos, createFertilizer, updateFertilizer, deleteFertilizer, createFertilizerCombo, deleteFertilizerCombo, updateFertilizerCombo } from '@/app/actions/fertilizers'
import { Fertilizer, FertilizerCombo } from '@/app/lib/types'

export default function FertilizersPage() {
  const [activeTab, setActiveTab] = useState<'productos' | 'combos'>('productos')
  const [fertilizers, setFertilizers] = useState<Fertilizer[]>([])
  const [combos, setCombos] = useState<FertilizerCombo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isComboModalOpen, setIsComboModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Fertilizer | null>(null)
  const [editingCombo, setEditingCombo] = useState<FertilizerCombo | null>(null)

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
    if (editingProduct) {
      await updateFertilizer(editingProduct.id, data)
    } else {
      await createFertilizer(data)
    }
    await loadData()
    return { error: null }
  }

  const handleDeleteProduct = async (id: number) => {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      await deleteFertilizer(id)
      await loadData()
    }
  }

  const handleSaveCombo = async (data: Partial<FertilizerCombo>) => {
    if (editingCombo) {
      await updateFertilizerCombo(editingCombo.id, data)
    } else {
      await createFertilizerCombo(data)
    }
    await loadData()
    return { error: null }
  }

  const handleDeleteCombo = async (id: number) => {
    if (confirm('¿Estás seguro de eliminar este combo?')) {
      await deleteFertilizerCombo(id)
      await loadData()
    }
  }

  const stageLabels: Record<string, string> = {
    todo: 'Todo el ciclo',
    enraizamiento: 'Enraizamiento',
    vegetativo: 'Vegetativo',
    floracion: 'Floración',
    lavado: 'Lavado de Raíces'
  }

  return (
    <div className="min-h-screen bg-[#F5F5F1] dark:bg-[#0B0C10] pb-24 lg:pb-8 flex flex-col font-sans">
      <DesktopNavbar />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 lg:px-8 pt-6">
        <header className="mb-8">
          <h1 className="text-3xl font-serif font-bold text-slate-800 dark:text-white">Nutrición</h1>
          <p className="text-slate-500 mt-2">Gestiona tus fertilizantes y armas tus combos nutricionales.</p>
        </header>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-white/10">
          <button
            onClick={() => setActiveTab('productos')}
            className={`pb-3 font-medium transition-colors ${
              activeTab === 'productos'
                ? 'text-brand-primary border-b-2 border-brand-primary'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Productos
          </button>
          <button
            onClick={() => setActiveTab('combos')}
            className={`pb-3 font-medium transition-colors ${
              activeTab === 'combos'
                ? 'text-brand-primary border-b-2 border-brand-primary'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Combos Nutricionales
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12 text-slate-400">Cargando...</div>
        ) : activeTab === 'productos' ? (
          <div className="space-y-4">
            <button
              onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }}
              className="w-full sm:w-auto flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl hover:bg-brand-primary-hover transition-colors font-medium mb-4"
            >
              <Plus size={18} />
              Agregar Producto
            </button>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fertilizers.map(fert => (
                <div key={fert.id} className="bg-white dark:bg-[#12141C] p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 relative group">
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingProduct(fert); setIsProductModalOpen(true); }} className="p-1.5 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-500 hover:text-brand-primary">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDeleteProduct(fert.id)} className="p-1.5 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-500 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
                      <FlaskConical size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-white">{fert.name}</h3>
                      <p className="text-xs text-slate-500">{fert.brand}</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                    <p><span className="font-medium">Etapa:</span> {stageLabels[fert.stage]}</p>
                    <p><span className="font-medium">Dosis:</span> {fert.dose_type === 'fija' ? `${fert.dose_fixed} ml/L` : 'Tabla por Semanas'}</p>
                  </div>
                </div>
              ))}
            </div>
            {fertilizers.length === 0 && (
              <div className="text-center py-12 bg-white dark:bg-[#12141C] rounded-2xl border border-slate-100 dark:border-white/5 text-slate-500">
                No hay productos registrados.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => { setEditingCombo(null); setIsComboModalOpen(true); }}
              className="w-full sm:w-auto flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl hover:bg-brand-primary-hover transition-colors font-medium mb-4"
            >
              <Plus size={18} />
              Armar Combo
            </button>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {combos.map(combo => (
                <div key={combo.id} className="bg-white dark:bg-[#12141C] p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 relative group">
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingCombo(combo); setIsComboModalOpen(true); }} className="p-1.5 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-500 hover:text-brand-primary">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDeleteCombo(combo.id)} className="p-1.5 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-500 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                      <Layers size={20} />
                    </div>
                    <h3 className="font-bold text-slate-800 dark:text-white">{combo.name}</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500">Productos ({combo.products?.length || 0}):</p>
                    <div className="flex flex-wrap gap-2">
                      {combo.products?.map((p, idx) => (
                        <span key={idx} className="px-2 py-1 bg-[#F5F5F1] dark:bg-white/5 text-slate-600 dark:text-slate-300 text-xs rounded-lg">
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {combos.length === 0 && (
              <div className="text-center py-12 bg-white dark:bg-[#12141C] rounded-2xl border border-slate-100 dark:border-white/5 text-slate-500">
                No hay combos registrados.
              </div>
            )}
          </div>
        )}
      </main>

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

      <BottomNav />
    </div>
  )
}
