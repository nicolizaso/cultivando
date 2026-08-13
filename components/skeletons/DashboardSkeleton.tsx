export default function DashboardSkeleton() {
  return (
    <div className="w-full" aria-busy="true" aria-label="Cargando el panel">
      <div className="mb-8">
        <div className="skeleton mb-2 h-8 w-48" />
        <div className="skeleton h-4 w-32" />
      </div>

      {/* La silueta replica la grilla real para que no haya salto al cargar */}
      <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="surface flex h-28 flex-col justify-between rounded-[var(--radius-lg)] p-5">
            <div className="skeleton h-3 w-2/3" />
            <div className="flex items-end justify-between">
              <div className="skeleton h-8 w-12" />
              <div className="skeleton h-7 w-7 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="skeleton h-6 w-40" />
            <div className="skeleton h-4 w-20" />
          </div>
          <div className="skeleton h-44 w-full rounded-[var(--radius-lg)]" />
          <div className="skeleton h-44 w-full rounded-[var(--radius-lg)]" />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="skeleton h-6 w-24" />
            <div className="skeleton h-9 w-9 rounded-full" />
          </div>
          <div className="skeleton h-80 w-full rounded-[var(--radius-lg)]" />
        </div>
      </div>
    </div>
  );
}
