'use client'

import { useState } from 'react'
import CalendarWidget from './CalendarWidget'
import DashboardFab from './DashboardFab'
import AgendaModal from './AgendaModal'
import { Task } from '@/app/lib/types'
import { ClipboardList } from 'lucide-react'

interface CalendarViewProps {
  logs: any[]
  tasks: Task[]
  plants: any[]
  spaces: any[]
  cycles?: { id: number; name: string; space_id?: number }[]
}

export default function CalendarView({ logs, tasks, plants, spaces, cycles = [] }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedCycleId, setSelectedCycleId] = useState<number | 'all'>('all')
  const [isAgendaOpen, setIsAgendaOpen] = useState(false)

  const isAll = selectedCycleId === 'all'
  const filteredTasks = tasks.filter(t => isAll || (t.cycleIds && t.cycleIds.includes(selectedCycleId as number)))

  const filteredLogs = selectedCycleId === 'all'
    ? logs
    : logs.filter(l => l.cycle_id === selectedCycleId)

  return (
    <>
      <div className="pb-28">
        <div className="mb-4 flex items-start justify-between gap-3">
          {cycles.length > 0 ? (
            <div
              role="group"
              aria-label="Filtrar por ciclo"
              className="custom-scrollbar -mx-1 flex flex-1 gap-2 overflow-x-auto px-1 pb-2"
            >
              <button
                type="button"
                onClick={() => setSelectedCycleId('all')}
                aria-pressed={selectedCycleId === 'all'}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                  selectedCycleId === 'all'
                    ? 'border-transparent bg-brand text-[color:var(--brand-fg)]'
                    : 'border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg'
                }`}
              >
                Todos
              </button>
              {cycles.map(cycle => (
                <button
                  key={cycle.id}
                  type="button"
                  onClick={() => setSelectedCycleId(cycle.id)}
                  aria-pressed={selectedCycleId === cycle.id}
                  className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                    selectedCycleId === cycle.id
                      ? 'border-transparent bg-brand text-[color:var(--brand-fg)]'
                      : 'border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg'
                  }`}
                >
                  {cycle.name}
                </button>
              ))}
            </div>
          ) : <div className="flex-1" />}

          <button
            type="button"
            onClick={() => setIsAgendaOpen(true)}
            className="btn btn-secondary h-10 min-h-10 shrink-0 px-3"
          >
            <ClipboardList size={16} aria-hidden="true" />
            <span className="hidden md:inline">Agenda</span>
          </button>
        </div>

        <CalendarWidget
          logs={filteredLogs}
          tasks={filteredTasks}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
        />
      </div>

      <AgendaModal
        isOpen={isAgendaOpen}
        onClose={() => setIsAgendaOpen(false)}
        tasks={tasks} // Pass all tasks, modal handles its own filtering
        cycles={cycles}
      />

      <DashboardFab
        plants={plants}
        spaces={spaces}
        cycles={cycles}
        initialDate={selectedDate}
      />
    </>
  )
}
