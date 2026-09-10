'use client';

import React from 'react';
import { X } from 'lucide-react';

interface SelectionBarProps {
  count: number;
  /** Sustantivo en singular; el plural se arma con una "s". */
  noun?: string;
  onClear: () => void;
  children: React.ReactNode;
  label?: string;
}

/**
 * Barra flotante de acciones sobre una selección múltiple.
 *
 * La app repetía esta barra en cuatro sitios (plantas, tareas, fotos del ciclo
 * y tabla del ciclo), cada uno con su forma, su altura y su orden de botones.
 * Ahora es un componente: misma posición sobre la barra inferior, mismo orden
 * (contador, acciones, salir) y el mismo anuncio en vivo del recuento.
 */
export default function SelectionBar({
  count,
  noun = 'seleccionada',
  onClear,
  children,
  label = 'Acciones sobre la selección',
}: SelectionBarProps) {
  if (count === 0) return null;

  return (
    <div role="toolbar" aria-label={label} className="action-bar animate-sheet-in">
      <p className="whitespace-nowrap text-sm font-semibold text-fg" aria-live="polite">
        <span className="mono">{count}</span> {noun}
        {count === 1 ? '' : 's'}
      </p>

      <span className="mx-1 h-6 w-px bg-[color:var(--border)]" aria-hidden="true" />

      {children}

      <button
        type="button"
        onClick={onClear}
        className="btn-icon btn-icon-sm"
        aria-label="Salir del modo selección"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
