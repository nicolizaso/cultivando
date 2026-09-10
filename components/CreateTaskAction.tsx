'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import AddTaskModal from './AddTaskModal'

interface Plant { id: string; name: string; space_id?: number }
interface Space { id: number; name: string }

interface CreateTaskActionProps {
  plants: Plant[]
  spaces: Space[]
  cycles?: { id: number; name: string; space_id?: number }[]
  initialDate?: Date
}

/**
 * Acción principal "Nueva tarea".
 *
 * Se dibuja de dos formas excluyentes por viewport: botón en la cabecera de la
 * página a partir de 1024px y botón flotante por debajo. Es un único componente
 * con un único estado y un único modal, así que no hay dos rutas distintas para
 * la misma acción ni dos etiquetas que mantener sincronizadas.
 */
export default function CreateTaskAction({ plants, spaces, cycles, initialDate }: CreateTaskActionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="btn btn-primary hidden lg:inline-flex"
      >
        <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
        Nueva tarea
      </button>

      {/* Se apoya en el área segura del dispositivo y despeja la barra de pestañas. */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="group fixed right-4 bottom-[calc(var(--nav-bottom)+1rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-[color:var(--brand-fg)] shadow-[var(--shadow-lg)] transition-transform hover:scale-105 active:scale-95 lg:hidden"
        aria-label="Nueva tarea"
      >
        <Plus
          size={26}
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
