'use client'

import { CalendarDays, CheckCircle2 } from "lucide-react"
import { Task } from "@/app/lib/types"

export default function HomeTaskCard({ tasks }: { tasks: Task[] }) {
  const todayStr = new Date().toLocaleDateString('en-CA');
  const pendingCount = tasks.filter(t =>
    t.status === 'pending' &&
    t.due_date &&
    t.due_date.split('T')[0] === todayStr
  ).length;

  return (
    <div className="flex h-full flex-col justify-between rounded-[var(--radius-lg)] border border-[color:color-mix(in_srgb,var(--brand)_28%,transparent)] bg-brand-soft p-5">
      <p className="mb-3 text-xs font-semibold text-[color:var(--brand-text)]">Tareas de hoy</p>

      <div className="flex items-end justify-between gap-2">
        {pendingCount > 0 ? (
          <span className="font-title text-4xl font-semibold leading-none text-[color:var(--brand-text)]">
            {pendingCount}
            <span className="sr-only"> tareas pendientes</span>
          </span>
        ) : (
          <span className="flex items-center gap-2 text-[color:var(--brand-text)]">
            <CheckCircle2 size={22} aria-hidden="true" />
            <span className="text-sm font-semibold">Todo listo</span>
          </span>
        )}

        <CalendarDays
          className="h-7 w-7 shrink-0 text-[color:var(--brand-text)] opacity-70"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
