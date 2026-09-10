'use client';

import React, { useRef } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Contador opcional a la derecha de la etiqueta. */
  count?: number;
  /** Sólo para el modo icono: texto accesible del botón. */
  srLabel?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nombre accesible del grupo. */
  label: string;
  /** `tabs` añade la semántica de pestañas y enlaza con `panel-{value}`. */
  variant?: 'filter' | 'tabs';
  /** Oculta las etiquetas y deja sólo los iconos (conmutador de vista). */
  iconOnly?: boolean;
  className?: string;
}

/**
 * Un único control para "elegir una de N opciones". La app tenía tres patrones
 * distintos para lo mismo: pestañas subrayadas en Nutrición, píldoras de marca
 * en la Agenda y una caja segmentada en el detalle de ciclo.
 *
 * Incluye navegación con flechas, que es lo que un lector de pantalla espera de
 * un grupo de pestañas y lo que faltaba en las tres versiones anteriores.
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  variant = 'filter',
  iconOnly = false,
  className = '',
}: SegmentedControlProps<T>) {
  const isTabs = variant === 'tabs';
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;

    event.preventDefault();
    const index = options.findIndex(option => option.value === value);
    let next = index;

    if (event.key === 'ArrowRight') next = (index + 1) % options.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + options.length) % options.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = options.length - 1;

    onChange(options[next].value);
    listRef.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  };

  return (
    <div
      ref={listRef}
      role={isTabs ? 'tablist' : 'group'}
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={`segmented ${className}`}
    >
      {options.map(option => {
        const Icon = option.icon;
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role={isTabs ? 'tab' : undefined}
            id={isTabs ? `tab-${option.value}` : undefined}
            /* Sólo se renderiza el panel activo, así que apuntar desde una
               pestaña inactiva dejaría un aria-controls colgando. */
            aria-controls={isTabs && selected ? `panel-${option.value}` : undefined}
            aria-selected={isTabs ? selected : undefined}
            aria-pressed={isTabs ? undefined : selected}
            aria-label={iconOnly ? (option.srLabel ?? option.label) : undefined}
            tabIndex={isTabs && !selected ? -1 : 0}
            onClick={() => onChange(option.value)}
            className={`segmented-item ${iconOnly ? 'w-9 px-0' : ''}`}
          >
            {Icon && <Icon className="h-[15px] w-[15px] shrink-0" aria-hidden="true" />}
            {!iconOnly && option.label}
            {!iconOnly && typeof option.count === 'number' && (
              <span className={`mono text-[11px] ${selected ? 'text-fg-muted' : 'text-fg-subtle'}`}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
