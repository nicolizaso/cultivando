/**
 * Silueta genérica de página de listado.
 *
 * Las tres rutas con `loading.tsx` repetían el mismo bloque copiado, y ya no
 * coincidía con la retícula real. Ahora hay uno solo y recibe la forma.
 */
export default function PageSkeleton({
  cards = 6,
  height = 'h-[132px]',
  toolbar = true,
}: {
  cards?: number;
  height?: string;
  toolbar?: boolean;
}) {
  return (
    <div
      className="mx-auto w-full max-w-[1280px] px-4 pb-12 pt-5 sm:px-6 lg:px-8 lg:pt-8"
      aria-busy="true"
      aria-label="Cargando"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 lg:mb-8">
        <div className="space-y-2">
          <div className="skeleton h-8 w-40" />
          <div className="skeleton h-4 w-56" />
        </div>
        <div className="skeleton h-11 w-36 rounded-[var(--radius-md)]" />
      </div>

      {toolbar && (
        <div className="mb-5 flex flex-wrap gap-2">
          <div className="skeleton h-10 w-56 rounded-[var(--radius-md)]" />
          <div className="skeleton ml-auto h-10 w-44 rounded-[var(--radius-md)]" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className={`skeleton ${height} rounded-[var(--radius-lg)]`} />
        ))}
      </div>
    </div>
  );
}
