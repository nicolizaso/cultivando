'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ListChecks } from 'lucide-react'
import CalendarWidget from './CalendarWidget'
import type { CalendarLog } from './CalendarWidget'
import { todayKey } from '@/app/lib/dates'
import CreateTaskAction from './CreateTaskAction'
import AgendaModal from './AgendaModal'
import PageHeader from '@/components/layout/PageHeader'
import { Task } from '@/app/lib/types'
import type { CycleOption, PlantOption } from '@/app/lib/task-targets'

interface CalendarViewProps {
  /** El mes que se mira, "YYYY-MM". */
  month: string
  /** El día que llega elegido en la URL (`?dia=`), si es de este mes. */
  initialSelectedDay?: string
  logs: CalendarLog[]
  tasks: Task[]
  plants: PlantOption[]
  spaces: { id: number; name: string }[]
  cycles?: CycleOption[]
}

/** El día que arranca seleccionado: el de la URL, hoy si es este mes, o el 1. */
function initialDay(month: string, fromUrl?: string): string {
  if (fromUrl && fromUrl.startsWith(month)) return fromUrl
  const today = todayKey()
  return today.startsWith(month) ? today : `${month}-01`
}

export default function CalendarView({ month, initialSelectedDay, logs, tasks, plants, spaces, cycles = [] }: CalendarViewProps) {
  const router = useRouter()
  const [isNavigating, startNavigation] = useTransition()
  const [selectedDay, setSelectedDay] = useState<string>(() => initialDay(month, initialSelectedDay))
  const [selectedCycleId, setSelectedCycleId] = useState<number | 'all'>('all')
  const [isAgendaOpen, setIsAgendaOpen] = useState(false)

  const isAll = selectedCycleId === 'all'
  const filteredTasks = tasks.filter(t => isAll || (t.cycleIds && t.cycleIds.includes(selectedCycleId as number)))
  const filteredLogs = isAll ? logs : logs.filter(l => l.cycle_id === selectedCycleId)

  const pendingCount = tasks.filter(t => t.status === 'pending').length

  // Cambiar de mes pide ese mes al servidor: la página trae sólo lo que se ve.
  const goToMonth = (next: string, day?: string) => {
    startNavigation(() => {
      router.push(`/calendar?mes=${next}${day ? `&dia=${day}` : ''}`)
    })
  }

  const selectDay = (day: string) => {
    // Un día del mes vecino (los bordes de la grilla) abre ese mes con el día elegido.
    if (day.slice(0, 7) !== month) goToMonth(day.slice(0, 7), day)
    else setSelectedDay(day)
  }

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
            initialDate={new Date(`${selectedDay}T12:00:00`)}
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
        month={month}
        logs={filteredLogs}
        tasks={filteredTasks}
        selectedDay={selectedDay}
        onDaySelect={selectDay}
        onMonthChange={goToMonth}
        isLoading={isNavigating}
      />

      <AgendaModal
        isOpen={isAgendaOpen}
        onClose={() => setIsAgendaOpen(false)}
        tasks={tasks} // Las del mes y todas las pendientes; el modal filtra.
        cycles={cycles}
      />
    </>
  )
}
