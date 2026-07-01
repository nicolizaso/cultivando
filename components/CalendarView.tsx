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
      <div className="max-w-6xl mx-auto pb-32">
        <div className="flex items-center justify-between mb-2">
          {/* Filter Scroller */}
          {cycles.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide flex-1 mr-4">
              <button
                onClick={() => setSelectedCycleId('all')}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors
                  ${selectedCycleId === 'all'
                    ? 'bg-brand-primary text-foreground'
                    : 'bg-card text-muted border border-card-border hover:border-brand-primary/50 hover:text-foreground'}
                `}
              >
                Todos
              </button>
              {cycles.map(cycle => (
                <button
                  key={cycle.id}
                  onClick={() => setSelectedCycleId(cycle.id)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors
                    ${selectedCycleId === cycle.id
                      ? 'bg-brand-primary text-foreground'
                      : 'bg-card text-muted border border-card-border hover:border-brand-primary/50 hover:text-foreground'}
                  `}
                >
                  {cycle.name}
                </button>
              ))}
            </div>
          ) : <div className="flex-1" />}

          {/* Agenda Button */}
          <button
            onClick={() => setIsAgendaOpen(true)}
            className="flex items-center gap-2 bg-card hover:bg-card-border border border-card-border text-brand-primary px-4 py-2 rounded-full transition-colors mb-4"
          >
            <ClipboardList size={18} />
            <span className="text-xs font-bold uppercase hidden md:inline">Agenda</span>
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
