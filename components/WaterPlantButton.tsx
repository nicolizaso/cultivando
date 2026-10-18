'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Droplets } from 'lucide-react'
import BulkWaterModal from './BulkWaterModal'

/** "Regar" en la ficha de una planta: el mismo registro que el riego en lote. */
export default function WaterPlantButton({ plantId, defaultWeek }: { plantId: number; defaultWeek: number }) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(true)}>
        <Droplets size={16} aria-hidden="true" />
        Regar
      </button>
      <BulkWaterModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        selectedIds={[plantId]}
        onSuccess={() => router.refresh()}
        defaultWeek={defaultWeek}
      />
    </>
  )
}
