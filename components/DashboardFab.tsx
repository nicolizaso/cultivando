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
      {/* Se apoya en el área segura del dispositivo y despeja la barra inferior */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="group fixed right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-[color:var(--brand-fg)] shadow-[var(--shadow-lg)] transition-transform hover:scale-105 active:scale-95 md:bottom-8"
        aria-label="Crear tarea"
      >
        <Plus
          size={28}
          strokeWidth={2.5}
          className="transition-transform duration-300 group-hover:rotate-90"
          aria-hidden="true"
        />
      </button>

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
