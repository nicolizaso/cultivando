export default function DashboardSkeleton() {
  return (
    <div className="animate-pulse w-full">
      <div className="mb-8">
        <div className="h-8 w-48 bg-card-border dark:bg-slate-800 rounded mb-2"></div>
        <div className="h-4 w-32 bg-card-border dark:bg-slate-800 rounded"></div>
      </div>

      {/* KPIs Grid Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card h-28 rounded-2xl border border-card-border dark:border-slate-800 p-5 flex flex-col justify-between">
            <div className="h-3 w-2/3 bg-card-border dark:bg-slate-800 rounded"></div>
            <div className="flex justify-between items-end">
              <div className="h-8 w-12 bg-card-border dark:bg-slate-800 rounded"></div>
              <div className="h-8 w-8 bg-card-border dark:bg-slate-800 rounded-full"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Feed Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center mb-2">
             <div className="h-6 w-40 bg-card-border dark:bg-slate-800 rounded"></div>
             <div className="h-4 w-20 bg-card-border dark:bg-slate-800 rounded"></div>
          </div>
          <div className="bg-card h-40 rounded-2xl border border-card-border dark:border-slate-800"></div>
          <div className="bg-card h-40 rounded-2xl border border-card-border dark:border-slate-800"></div>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-center mb-2">
             <div className="h-6 w-24 bg-card-border dark:bg-slate-800 rounded"></div>
             <div className="h-8 w-8 bg-card-border dark:bg-slate-800 rounded-full"></div>
          </div>
          <div className="bg-card h-80 rounded-2xl border border-card-border dark:border-slate-800"></div>
        </div>
      </div>
    </div>
  );
}
