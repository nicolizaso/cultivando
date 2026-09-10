import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Acciones propias de la página (crear, filtrar...). El tema y la cuenta viven en la navegación. */
  actions?: React.ReactNode;
  /** Enlace de vuelta a la sección padre, en las páginas de detalle. */
  backHref?: string;
  backLabel?: string;
  className?: string;
}

/**
 * Cabecera de página: un solo h1 por pantalla y un solo sitio donde poner las
 * acciones. Sustituye al antiguo GlobalHeader, que además del título cargaba
 * con el lockup de marca, el conmutador de tema, el menú de cuenta y un
 * hamburguesa que duplicaba la navegación inferior.
 */
export default function PageHeader({
  title,
  subtitle,
  actions,
  backHref,
  backLabel = 'Volver',
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`mb-6 lg:mb-8 ${className}`}>
      {backHref && (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {backLabel}
        </Link>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-title text-[26px] font-semibold leading-tight tracking-tight text-fg lg:text-[32px]">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>}
        </div>

        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
