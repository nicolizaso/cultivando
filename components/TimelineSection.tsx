'use client';

import { useState } from 'react';
import {
  Calendar, ChevronDown, ChevronUp, Clock, History
} from 'lucide-react';
import Image from 'next/image';
import { formatDateShort } from '@/app/lib/utils';
import { getTaskIcon } from '@/app/lib/constants';

export interface TimelineItem {
  id: string;
  originalId: number | string;
  date: string;
  title: string;
  type: string; // 'riego', 'poda', 'log', 'image', etc.
  notes?: string;
  media_url?: string[];
  isTask?: boolean;
  status?: string; // 'pending', 'completed'
}

interface TimelineSectionProps {
  pendingTasks: TimelineItem[];
  historyItems: TimelineItem[];
}

export default function TimelineSection({ pendingTasks, historyItems }: TimelineSectionProps) {
  const [showAllPending, setShowAllPending] = useState(false);

  // Split pending tasks
  const nextTask = pendingTasks[0];
  // futureTasks sorted descending (furthest away first)
  const futureTasks = pendingTasks.slice(1).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const hiddenCount = futureTasks.length;

  // Helper to render a task card
  const renderTaskCard = (item: TimelineItem, isNext: boolean = false) => (
    <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group mb-8 last:mb-0">

      {/* Icon */}
      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-dashed border-slate-500 text-muted bg-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
        {getTaskIcon(item.type)}
      </div>

      {/* Card */}
      <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-card p-5 rounded-2xl border border-dashed ${isNext ? 'border-brand-primary/50 bg-brand-primary/5' : 'border-card-border'} hover:border-brand-primary/30 transition-colors shadow-sm`}>
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground text-sm">{item.title}</span>
            <span className="text-[9px] uppercase font-bold bg-slate-800 text-muted px-1.5 py-0.5 rounded">Pendiente</span>
          </div>
          <time className="text-[10px] text-muted uppercase tracking-widest font-bold">
            {formatDateShort(item.date)}
          </time>
        </div>
        {item.notes && <p className="text-muted text-xs leading-relaxed">&quot;{item.notes}&quot;</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-white/10 before:to-transparent">

      {/* --- PENDING TASKS SECTION --- */}
      {pendingTasks.length > 0 && (
        <div className="relative mb-8">

          {/* 1. Future Tasks (Expandable) - Top of the flow */}
          {showAllPending && (
            <div className="mb-8">
              {futureTasks.map((item) => renderTaskCard(item))}
            </div>
          )}

          {/* 2. Accordion Trigger Button - Middle */}
          {futureTasks.length > 0 && (
            <div className="relative flex items-center justify-center md:my-4 z-10 mb-8">
              <button
                onClick={() => setShowAllPending(!showAllPending)}
                className="flex items-center gap-2 bg-card border border-card-border text-muted hover:text-foreground px-4 py-2 rounded-full text-xs font-bold transition-all hover:border-slate-300"
              >
                {showAllPending ? (
                  <>
                    <ChevronUp size={14} /> Ocultar tareas futuras
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> Mostrar todas las tareas programadas
                  </>
                )}
              </button>
            </div>
          )}

          {/* 3. Next Task (The anchor) - Bottom of pending section */}
          {nextTask && renderTaskCard(nextTask, true)}

        </div>
      )}

      {/* --- HISTORY SECTION --- */}
      {historyItems.map((item) => (
        <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">

          {/* Icon */}
          <div className={`flex items-center justify-center w-10 h-10 rounded-full border ${item.type === 'image' ? 'border-brand-primary text-brand-primary' : 'border-card-border text-brand-primary'} bg-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10`}>
            {getTaskIcon(item.type)}
          </div>

          {/* Card */}
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-card p-5 rounded-2xl border border-card-border hover:border-brand-primary/30 transition-colors shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-sm">{item.title}</span>
                {item.type === 'image' && <span className="text-[9px] uppercase font-bold bg-brand-primary/20 text-brand-primary px-1.5 py-0.5 rounded">Foto</span>}
              </div>
              <time className="text-[10px] text-muted uppercase tracking-widest font-bold">
                {formatDateShort(item.date)}
              </time>
            </div>

            {item.notes && <p className="text-muted text-xs leading-relaxed mb-3">&quot;{item.notes}&quot;</p>}

            {/* Render Images (Log media OR Cycle Image public_url) */}
            {item.media_url && item.media_url.length > 0 && (
              <div className={`grid gap-2 mt-2 ${item.media_url.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {item.media_url.map((url: string, i: number) => (
                  <div key={i} className="relative h-32 w-full rounded-lg overflow-hidden border border-card-border group-hover:border-card-border transition-colors">
                    <Image src={url} alt="Timeline Media" fill className="object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {historyItems.length === 0 && pendingTasks.length === 0 && (
        <div className="text-center py-10 z-10 relative">
          <p className="text-muted text-sm">Sin registros aún.</p>
        </div>
      )}

    </div>
  );
}
