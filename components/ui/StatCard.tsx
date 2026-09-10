import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  /** Cifra principal. Se compone con `.metric` para usar cifras tabulares. */
  value: React.ReactNode;
  unit?: string;
  icon: LucideIcon;
  /** Si se pasa, la tarjeta entera es un enlace y lo señala con una flecha. */
  href?: string;
  /** `brand` para el indicador destacado de la fila; `plain` para el resto. */
  tone?: 'brand' | 'plain';
  hint?: string;
  className?: string;
}

/**
 * Indicador de la fila de resumen.
 *
 * Antes cada tarjeta del panel se escribía a mano y las cuatro acabaron con
 * tratamientos distintos: dos navegables y dos no, sin nada que distinguiera
 * unas de otras. Acá la regla es explícita: si tiene `href`, lo dice con una
 * flecha y reacciona al hover; si no, es una superficie quieta.
 */
export default function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  href,
  tone = 'plain',
  hint,
  className = '',
}: StatCardProps) {
  const isBrand = tone === 'brand';

  const body = (
    <>
      <div className="mb-4 flex items-start justify-between gap-2">
        <p className={`text-xs font-semibold ${isBrand ? 'text-[color:var(--brand-text)]' : 'text-fg-muted'}`}>
          {label}
        </p>

        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            isBrand ? 'bg-[color:var(--brand-soft-strong)] text-[color:var(--brand-text)]' : 'bg-surface-2 text-fg-muted'
          }`}
          aria-hidden="true"
        >
          <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
        </span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className={`metric text-[34px] ${isBrand ? 'text-[color:var(--brand-text)]' : 'text-fg'}`}>
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-fg-muted">{unit}</span>}
      </div>

      <p className="mt-1.5 flex min-h-[18px] items-center gap-1 text-xs text-fg-subtle">
        {hint}
        {href && (
          <ArrowUpRight
            className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        )}
      </p>
    </>
  );

  const shape = `flex h-full flex-col rounded-[var(--radius-lg)] p-4 sm:p-5 ${className}`;

  if (href) {
    return (
      <Link
        href={href}
        className={`group ${isBrand ? 'border border-[color:color-mix(in_srgb,var(--brand)_28%,transparent)] bg-brand-soft transition-colors hover:border-[color:var(--brand)]' : 'surface-interactive'} ${shape}`}
      >
        {body}
      </Link>
    );
  }

  return (
    <div
      className={`${isBrand ? 'border border-[color:color-mix(in_srgb,var(--brand)_28%,transparent)] bg-brand-soft' : 'surface'} ${shape}`}
    >
      {body}
    </div>
  );
}
