'use client';

import React from 'react';
import { Loader2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
 * Un mismo componente para plantas, tareas, fotos y la tabla del ciclo. En el
 * teléfono es un panel a lo ancho, con el recuento arriba y las acciones en
 * una grilla de botones iguales (ícono sobre texto), que entra en una sola
 * fila aunque sean cinco. Antes era una píldora que, al envolverse en una
 * pantalla angosta, quedaba como un círculo con los botones desparramados.
 * Desde tablet en adelante vuelve a ser una sola fila centrada.
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
      <div className="action-bar-head">
        <p className="whitespace-nowrap text-sm font-semibold text-fg" aria-live="polite">
          <span className="action-bar-count mono">{count}</span>
          {noun}
          {count === 1 ? '' : 's'}
        </p>

        <button
          type="button"
          onClick={onClear}
          className="btn-icon btn-icon-sm action-bar-close"
          aria-label="Salir del modo selección"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="action-bar-actions">{children}</div>
    </div>
  );
}

interface SelectionActionProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** Muestra un spinner en lugar del ícono. */
  pending?: boolean;
}

/** Un botón de la barra de selección. */
export function SelectionAction({
  icon: Icon,
  label,
  onClick,
  tone = 'default',
  disabled,
  pending,
}: SelectionActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className={`action-bar-btn${tone === 'danger' ? ' action-bar-btn-danger' : ''}`}
    >
      {pending
        ? <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        : <Icon size={18} aria-hidden="true" />}
      <span>{label}</span>
    </button>
  );
}
