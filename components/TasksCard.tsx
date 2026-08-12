import { createClient } from "@/app/lib/supabase-server"
import Link from "next/link"
import { Calendar as CalendarIcon, ArrowRight, CheckCircle2 } from "lucide-react"
import TaskPill from "@/components/TaskPill"
import { Task } from "@/app/lib/types"

export default async function TasksCard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Obtenemos las próximas 4 tareas pendientes
  const { data: tasksData } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('date', { ascending: true }) // Las más urgentes primero
    .limit(4)

  // Mapeamos los datos al tipo Task (asegurando compatibilidad)
  const tasks = (tasksData || []).map(t => ({
    ...t,
    date: t.date || t.due_date // Manejo de compatibilidad de fecha
  })) as Task[]

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-brand-soft text-[color:var(--brand-text)]" aria-hidden="true">
            <CalendarIcon size={15} />
          </span>
          Próximas tareas
        </h2>
        <Link
          href="/calendar"
          className="flex items-center gap-1 text-xs font-semibold text-fg-muted transition-colors hover:text-fg"
        >
          Ver todo
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>

      <div className="custom-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {tasks.length > 0 ? (
          tasks.map(task => (
            // readOnly: la interacción completa vive en la Agenda
            <TaskPill key={task.id} task={task} readOnly={true} />
          ))
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
            <CheckCircle2 size={28} className="text-fg-subtle" aria-hidden="true" />
            <p className="text-sm font-medium text-fg">Estás al día</p>
            <p className="text-xs text-fg-muted">No hay tareas pendientes.</p>
          </div>
        )}
      </div>
    </div>
  )
}
