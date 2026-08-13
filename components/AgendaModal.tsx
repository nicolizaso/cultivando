'use client'

import { useState } from 'react'
import { Task } from '@/app/lib/types'
import AgendaList from './AgendaList'
import Modal from '@/components/ui/Modal'

interface AgendaModalProps {
  isOpen: boolean
  onClose: () => void
  tasks: Task[]
  cycles: { id: number; name: string }[]
}

export default function AgendaModal({ isOpen, onClose, tasks, cycles }: AgendaModalProps) {
  const [selectedCycleId, setSelectedCycleId] = useState<number | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')

  const isAll = selectedCycleId === 'all';
  const filteredTasks = tasks.filter(t => {
    const matchesCycle = isAll || (t.cycleIds && t.cycleIds.includes(selectedCycleId as number));
    const matchesStatus = statusFilter === 'all' ? true : t.status === statusFilter
    return matchesCycle && matchesStatus
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agenda" size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="agenda-cycle" className="field-label">Ciclo</label>
            <select
              id="agenda-cycle"
              value={selectedCycleId}
              onChange={(e) => {
                const val = e.target.value
                setSelectedCycleId(val === 'all' ? 'all' : Number(val))
              }}
              className="field-input"
            >
              <option value="all">Todos los ciclos</option>
              {cycles.map(cycle => (
                <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="agenda-status" className="field-label">Estado</label>
            <select
              id="agenda-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'completed')}
              className="field-input"
            >
              <option value="all">Todas</option>
              <option value="pending">Pendientes</option>
              <option value="completed">Completadas</option>
            </select>
          </div>
        </div>

        {/* La lista se anuncia al filtrar: el recuento cambia sin recargar la vista */}
        <div aria-live="polite">
          <AgendaList
            tasks={filteredTasks}
            disableDateFilter={true}
            groupByStatus={true}
          />
        </div>
      </div>
    </Modal>
  )
}
