'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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

  // Tarjeta de tarea pendiente
  const renderTaskCard = (item: TimelineItem, isNext: boolean = false) => (
    <li key={item.id} className="group relative mb-6 flex items-start gap-4 last:mb-0">
      <span
        className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong bg-surface text-fg-muted"
        aria-hidden="true"
      >
        {getTaskIcon(item.type)}
      </span>

      <article
        className={`min-w-0 flex-1 rounded-[var(--radius-lg)] border p-4 ${
          isNext
            ? 'border-[color:color-mix(in_srgb,var(--brand)_35%,transparent)] bg-brand-soft'
            : 'border-line bg-surface'
        }`}
      >
        <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
            {item.title}
            <span className="chip chip-neutral">Pendiente</span>
          </h3>
          <time className="text-xs font-medium text-fg-muted" dateTime={item.date}>
            {formatDateShort(item.date)}
          </time>
        </div>
        {item.notes && <p className="text-xs leading-relaxed text-fg-muted">{item.notes}</p>}
      </article>
    </li>
  );

  return (
    /* Una sola columna con la guía a la izquierda: la versión anterior
       alternaba lados en escritorio y el orden de lectura no coincidía con
       el orden del DOM. */
    <div className="relative before:absolute before:bottom-0 before:left-5 before:top-0 before:w-px before:bg-[color:var(--border)]">
      {pendingTasks.length > 0 && (
        <div className="relative mb-6">
          {showAllPending && (
            <ul className="mb-6">{futureTasks.map((item) => renderTaskCard(item))}</ul>
          )}

          {futureTasks.length > 0 && (
            <div className="relative z-10 mb-6 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllPending(!showAllPending)}
                aria-expanded={showAllPending}
                className="btn btn-sm btn-secondary rounded-full"
              >
                {showAllPending ? (
                  <>
                    <ChevronUp size={14} aria-hidden="true" />
                    Ocultar tareas futuras
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} aria-hidden="true" />
                    Ver las {hiddenCount} tareas programadas
                  </>
                )}
              </button>
            </div>
          )}

          {nextTask && <ul>{renderTaskCard(nextTask, true)}</ul>}
        </div>
      )}

      <ul>
        {historyItems.map((item) => (
          <li key={item.id} className="group relative mb-6 flex items-start gap-4 last:mb-0">
            <span
              className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-surface ${
                item.type === 'image'
                  ? 'border-[color:var(--brand)] text-[color:var(--brand-text)]'
                  : 'border-line text-[color:var(--brand-text)]'
              }`}
              aria-hidden="true"
            >
              {getTaskIcon(item.type)}
            </span>

            <article className="min-w-0 flex-1 rounded-[var(--radius-lg)] border border-line bg-surface p-4">
              <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                  {item.title}
                  {item.type === 'image' && (
                    <span className="chip chip-brand">
                      Foto
                    </span>
                  )}
                </h3>
                <time className="text-xs font-medium text-fg-muted" dateTime={item.date}>
                  {formatDateShort(item.date)}
                </time>
              </div>

              {item.notes && <p className="mb-3 text-xs leading-relaxed text-fg-muted">{item.notes}</p>}

              {item.media_url && item.media_url.length > 0 && (
                <div className={`mt-2 grid gap-2 ${item.media_url.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {item.media_url.map((url: string, i: number) => (
                    <div key={i} className="relative h-32 w-full overflow-hidden rounded-[var(--radius-md)] border border-line">
                      <Image src={url} alt={`Foto de ${item.title}`} fill sizes="(min-width: 768px) 320px, 50vw" className="object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </article>
          </li>
        ))}
      </ul>

      {historyItems.length === 0 && pendingTasks.length === 0 && (
        <p className="relative z-10 py-10 text-center text-sm text-fg-muted">Sin registros todavía.</p>
      )}
    </div>
  );
}
