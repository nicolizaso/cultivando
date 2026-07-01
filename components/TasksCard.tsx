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
    <div className="flex flex-col h-full">
      {/* Header de la Tarjeta */}
      <div className="flex justify-between items-center mb-4 px-2">
        <div className="flex items-center gap-2">
           <div className="p-1.5 rounded-lg bg-brand-primary/10">
              <CalendarIcon size={16} className="text-brand-primary" />
           </div>
           <span className="text-xs font-bold text-foreground dark:text-slate-300 uppercase tracking-wider">Próximas Tareas</span>
        </div>
        <Link 
          href="/calendar" 
          className="text-[10px] font-bold text-brand-muted hover:text-brand-text flex items-center gap-1 transition-colors"
        >
          VER TODO <ArrowRight size={12} />
        </Link>
      </div>

      {/* Lista de Tareas */}
      <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1">
        {tasks.length > 0 ? (
          tasks.map(task => (
            // Usamos readOnly aquí porque la interacción compleja 
            // la dejaremos para la página de Agenda completa
            <TaskPill key={task.id} task={task} readOnly={true} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted dark:text-muted py-6 gap-2">
            <CheckCircle2 size={32} className="opacity-20" />
            <p className="text-xs font-medium text-center">¡Estás al día!</p>
            <p className="text-[10px] text-center opacity-60">No hay tareas pendientes.</p>
          </div>
        )}
      </div>
      
      {/* Nota al pie */}
      {tasks.length > 0 && (
        <div className="mt-4 pt-3 border-t border-card-border dark:border-slate-800 text-center">
           <p className="text-[10px] text-brand-muted">
             Tienes {tasks.length} pendiente{tasks.length !== 1 ? 's' : ''} visible{tasks.length !== 1 ? 's' : ''}.
           </p>
        </div>
      )}
    </div>
  )
}