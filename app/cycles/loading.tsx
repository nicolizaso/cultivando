import { Sprout } from "lucide-react";

export default function CyclesLoading() {
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

      {/* Fake Add Button */}
      <div className="flex justify-end mb-6">
        <div className="h-10 w-32 bg-card-border rounded-lg dark:bg-slate-800"></div>
      </div>

      {/* Fake Cycles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card h-64 rounded-2xl border border-card-border dark:border-slate-800 p-5 flex flex-col justify-between">
            <div className="flex justify-between">
              <div className="h-6 w-1/2 bg-card-border dark:bg-slate-800 rounded"></div>
              <div className="h-6 w-1/4 bg-card-border dark:bg-slate-800 rounded-full"></div>
            </div>
            <div className="space-y-3">
              <div className="h-4 w-3/4 bg-card-border dark:bg-slate-800 rounded"></div>
              <div className="h-4 w-1/2 bg-card-border dark:bg-slate-800 rounded"></div>
              <div className="h-4 w-2/3 bg-card-border dark:bg-slate-800 rounded"></div>
            </div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-card-border dark:border-slate-800">
               <div className="h-8 w-8 bg-card-border dark:bg-slate-800 rounded-full"></div>
               <div className="h-4 w-20 bg-card-border dark:bg-slate-800 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
