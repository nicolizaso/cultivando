export default function PlantsLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[1400px] px-5 py-6 md:px-8 md:py-8"
      aria-busy="true"
      aria-label="Cargando"
    >
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="skeleton h-6 w-40" />
          <div className="skeleton h-4 w-28" />
        </div>
        <div className="skeleton h-11 w-11 rounded-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-40 rounded-[var(--radius-lg)]" />
        ))}
      </div>
    </div>
  );
}
