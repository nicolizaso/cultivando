import { Sprout } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pb-24 font-body animate-pulse">
      {/* Fake Header */}
      <div className="flex justify-between items-center mb-6 pt-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Sprout className="text-brand-primary/50 w-6 h-6" strokeWidth={2.5} />
            <div className="h-6 w-24 bg-card-border rounded-md dark:bg-slate-800"></div>
          </div>
          <div className="h-4 w-32 bg-card-border rounded-md hidden md:block mt-1 dark:bg-slate-800"></div>
        </div>
        <div className="flex items-center gap-2">
           <div className="h-10 w-10 rounded-full bg-card-border dark:bg-slate-800 hidden md:block"></div>
        </div>
      </div>

      {/* Fake Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-card h-40 rounded-2xl border border-card-border dark:border-slate-800 p-5 flex flex-col justify-between">
            <div>
              <div className="h-3 w-1/3 bg-card-border dark:bg-slate-800 rounded mb-4"></div>
              <div className="h-6 w-2/3 bg-card-border dark:bg-slate-800 rounded mb-2"></div>
            </div>
            <div className="flex justify-between items-end">
              <div className="h-8 w-16 bg-card-border dark:bg-slate-800 rounded"></div>
              <div className="h-8 w-8 bg-card-border dark:bg-slate-800 rounded-full"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
