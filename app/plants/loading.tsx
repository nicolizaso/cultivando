import { Sprout } from "lucide-react";

export default function PlantsLoading() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pb-24 font-body animate-pulse">
      {/* Fake Global Header */}
      <div className="flex justify-between items-center mb-6 pt-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Sprout className="text-brand-primary/50 w-6 h-6" strokeWidth={2.5} />
            <div className="h-6 w-24 bg-card-border rounded-md dark:bg-slate-800"></div>
          </div>
          <div className="h-4 w-32 bg-card-border rounded-md hidden md:block mt-1 dark:bg-slate-800"></div>
        </div>
      </div>

      {/* Fake Filter Bar */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
         <div className="h-10 w-24 bg-card-border rounded-lg dark:bg-slate-800 shrink-0"></div>
         <div className="h-10 w-24 bg-card-border rounded-lg dark:bg-slate-800 shrink-0"></div>
         <div className="h-10 w-24 bg-card-border rounded-lg dark:bg-slate-800 shrink-0"></div>
         <div className="h-10 w-10 bg-card-border rounded-lg dark:bg-slate-800 shrink-0 ml-auto"></div>
      </div>

      {/* Fake Plants Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="bg-card h-48 rounded-2xl border border-card-border dark:border-slate-800 p-4 flex flex-col items-center justify-center space-y-4">
            <div className="h-16 w-16 bg-card-border dark:bg-slate-800 rounded-full"></div>
            <div className="h-4 w-2/3 bg-card-border dark:bg-slate-800 rounded"></div>
            <div className="h-3 w-1/2 bg-card-border dark:bg-slate-800 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
