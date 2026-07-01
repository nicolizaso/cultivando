'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import AddTaskModal from './AddTaskModal'

interface Plant { id: string; name: string; space_id?: number; }
interface Space { id: number; name: string; }

export default function DashboardFab({ plants, spaces, cycles, initialDate }: { plants: Plant[], spaces: Space[], cycles?: { id: number; name: string; space_id?: number }[], initialDate?: Date }) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      {/* Botón Flotante (FAB) */}
      <button 
        onClick={() => setIsModalOpen(true)}
        // CAMBIO AQUÍ: Usamos bottom-[110px] para darle la altura exacta que pediste
        className="fixed bottom-[110px] right-6 z-40 w-14 h-14 bg-brand-primary hover:bg-brand-primary-hover rounded-full shadow-sm flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95 group"
        aria-label="Crear Tarea"
      >
        <Plus size={32} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-300" />
      </button>

      {/* Modal de Creación */}
      <AddTaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        plants={plants}
        spaces={spaces}
        cycles={cycles}
        initialDate={initialDate}
      />
    </>
  )
}