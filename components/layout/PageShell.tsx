import React from 'react';

const WIDTHS = {
  default: 'max-w-[1280px]',
  /** Formularios y lecturas largas: una columna cómoda, no una sábana. */
  narrow: 'max-w-3xl',
} as const;

/**
 * Contenedor único de página. Antes cada ruta repetía su propia combinación de
 * ancho y padding (una usaba max-w-5xl y las demás max-w-[1400px]), así que la
 * app cambiaba de márgenes al navegar. Acá se decide una sola vez.
 */
export default function PageShell({
  children,
  size = 'default',
  className = '',
}: {
  children: React.ReactNode;
  size?: keyof typeof WIDTHS;
  className?: string;
}) {
  return (
    <main className={`mx-auto w-full ${WIDTHS[size]} px-4 pb-12 pt-5 sm:px-6 lg:px-8 lg:pt-8 ${className}`}>
      {children}
    </main>
  );
}
