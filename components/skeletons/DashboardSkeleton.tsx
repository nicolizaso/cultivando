/**
 * La silueta replica la retícula real (cabecera, cuatro indicadores y las dos
 * columnas del feed) para que al llegar los datos nada salte de sitio.
 */
export default function DashboardSkeleton() {
  return (
    <div className="w-full" aria-busy="true" aria-label="Cargando el panel">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 lg:mb-8">
        <div className="space-y-2">
          <div className="skeleton h-8 w-52" />
          <div className="skeleton h-4 w-36" />
        </div>
        <div className="skeleton hidden h-11 w-36 rounded-[var(--radius-md)] lg:block" />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-10 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="surface flex h-[132px] flex-col justify-between rounded-[var(--radius-lg)] p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div className="skeleton h-3.5 w-20" />
              <div className="skeleton h-8 w-8 rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="skeleton h-8 w-14" />
              <div className="skeleton h-3 w-16" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-4 lg:col-span-2">
          <div className="skeleton h-5 w-32" />
          <div className="skeleton h-56 rounded-[var(--radius-lg)]" />
          <div className="skeleton h-56 rounded-[var(--radius-lg)]" />
        </div>
        <div className="space-y-4">
          <div className="skeleton h-5 w-28" />
          <div className="skeleton h-72 rounded-[var(--radius-lg)]" />
        </div>
      </div>
    </div>
  );
}
