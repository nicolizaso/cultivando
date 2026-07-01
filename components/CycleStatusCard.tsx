"use client";

import Link from "next/link";
import { ArrowRight, Leaf } from "lucide-react";
import { Plant } from "@/app/lib/types";
import { groupPlants } from "@/app/lib/plant-grouping";

interface SpaceInfo {
  id: number;
  name: string;
  type: string;
}

export interface CycleWithPlantsAndSpace {
  id: number;
  name: string;
  start_date: string;
  space_id: number;
  plants: Plant[];
  spaces: SpaceInfo | null; // Allow null just in case
  cycle_images?: { public_url: string }[];
}

interface CycleStatusCardProps {
  cycle: CycleWithPlantsAndSpace;
}

export default function CycleStatusCard({ cycle }: CycleStatusCardProps) {
  const daysDiff = Math.floor(
    (new Date().getTime() - new Date(cycle.start_date).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  const groupedPlants = groupPlants(cycle.plants || []);
  const latestImage = cycle.cycle_images?.[0]?.public_url;

  return (
    <div className="group relative bg-card rounded-2xl p-6 border border-card-border hover:border-brand-primary/30 transition-all duration-300 overflow-hidden">
      {/* Background Decor or Image */}
      {latestImage ? (
        <>
          <img
            src={latestImage}
            alt={cycle.name}
            className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-90 transition-opacity z-0"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20 z-0" />
        </>
      ) : (
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {cycle.spaces && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase font-body ${latestImage ? 'bg-card-border backdrop-blur-md border-card-border/20 text-[#FAF9F6]' : 'bg-background text-[#1B3022] border-card-border'}`}>
                {cycle.spaces.name}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase font-body ${latestImage ? 'bg-card-border backdrop-blur-md border-card-border/20 text-[#FAF9F6]' : 'bg-brand-primary/10 text-brand-primary border-brand-primary/20'}`}>
              Día {daysDiff}
            </span>
          </div>
          <h3 className={`text-2xl md:text-3xl font-light font-title ${latestImage ? 'text-[#FAF9F6]' : 'text-[#1B3022]'}`}>{cycle.name}</h3>
        </div>
        <Link
          href={`/cycles/${cycle.id}`}
          className="mt-4 md:mt-0 bg-card text-foreground px-6 py-2 rounded-full text-sm font-bold font-body hover:bg-brand-primary hover:text-foreground transition-all shadow-sm shadow-brand-primary/10 flex items-center gap-2"
        >
          Ver Ciclo <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Plants List */}
      <div className="relative z-10">
        <p className={`text-xs uppercase font-bold mb-3 font-body ${latestImage ? 'text-white/80' : 'text-muted'}`}>
          Plantas ({cycle.plants?.length || 0})
        </p>
        <div className="flex flex-wrap gap-2">
          {groupedPlants.length > 0 ? (
            groupedPlants.map((group) => (
              <Link
                key={group.id}
                href={group.href}
                className={`flex items-center gap-2 border rounded-full pr-3 pl-1 py-1 transition-colors group/badge ${latestImage ? 'bg-card-border backdrop-blur-md border-card-border/20 hover:border-card-border/40' : 'bg-background border-card-border hover:border-brand-primary/50'}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${latestImage ? 'bg-card-border text-white group-hover/badge:bg-card/30' : 'bg-slate-800 text-muted group-hover/badge:bg-slate-700'}`}>
                  <Leaf className="w-3 h-3" />
                </div>
                <span className={`text-xs font-body transition-colors ${latestImage ? 'text-[#FAF9F6]' : 'text-foreground group-hover/badge:text-foreground'}`}>
                  {group.label}
                </span>
              </Link>
            ))
          ) : (
             <span className={`text-xs font-body italic ${latestImage ? 'text-white/80' : 'text-muted'}`}>Sin plantas registradas</span>
          )}
        </div>
      </div>
    </div>
  );
}
