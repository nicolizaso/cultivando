'use client'

import { useState } from 'react'
import { ListChecks } from 'lucide-react'
import CalendarWidget from './CalendarWidget'
import CreateTaskAction from './CreateTaskAction'
import AgendaModal from './AgendaModal'
import PageHeader from '@/components/layout/PageHeader'
import { Task } from '@/app/lib/types'

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
  const filteredLogs = isAll ? logs : logs.filter(l => l.cycle_id === selectedCycleId)

  const pendingCount = tasks.filter(t => t.status === 'pending').length

  return (
    <>
      {/* La cabecera vive acá porque la acción principal necesita saber qué día
          está seleccionado: la tarea nueva se crea sobre ese día, no sobre hoy. */}
      <PageHeader
        title="Agenda"
        subtitle="Calendario de tareas, riegos y fotos del cultivo"
        actions={
          <CreateTaskAction
            plants={plants}
            spaces={spaces}
            cycles={cycles}
            initialDate={selectedDate}
          />
        }
      />

      <div className="mb-4 flex items-center gap-3">
        {cycles.length > 0 ? (
          <div
            role="group"
            aria-label="Filtrar por ciclo"
            className="scrollbar-none -mx-1 flex flex-1 gap-2 overflow-x-auto px-1 py-1"
          >
            {[{ id: 'all' as const, name: 'Todos los ciclos' }, ...cycles].map(cycle => {
              const isSelected = selectedCycleId === cycle.id
              return (
                <button
                  key={cycle.id}
                  type="button"
                  onClick={() => setSelectedCycleId(cycle.id as number | 'all')}
                  aria-pressed={isSelected}
                  className={`h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
                    isSelected
                      ? 'border-transparent bg-brand text-[color:var(--brand-fg)]'
                      : 'border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg'
                  }`}
                >
                  {cycle.name}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Antes se llamaba "Agenda", igual que la página y que la pestaña de
            navegación: tres cosas distintas con el mismo nombre en pantalla. */}
        <button
          type="button"
          onClick={() => setIsAgendaOpen(true)}
          className="btn btn-sm btn-secondary shrink-0"
        >
          <ListChecks size={15} aria-hidden="true" />
          <span className="hidden sm:inline">Todas las tareas</span>
          <span className="sm:hidden">Tareas</span>
          {pendingCount > 0 && <span className="mono text-[11px] text-fg-muted">{pendingCount}</span>}
        </button>
      </div>

      <CalendarWidget
        logs={filteredLogs}
        tasks={filteredTasks}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
      />

      <AgendaModal
        isOpen={isAgendaOpen}
        onClose={() => setIsAgendaOpen(false)}
        tasks={tasks} // Pass all tasks, modal handles its own filtering
        cycles={cycles}
      />
    </>
  )
}
