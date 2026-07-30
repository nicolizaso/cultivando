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
  isCompact?: boolean;
}

export default function CycleStatusCard({ cycle, isCompact = false }: CycleStatusCardProps) {
  const daysDiff = Math.floor(
    (new Date().getTime() - new Date(cycle.start_date).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  const groupedPlants = groupPlants(cycle.plants || []);
  const latestImage = cycle.cycle_images?.[0]?.public_url;

  return (
    <div
      className={`group relative glass-card-interactive rounded-3xl p-6 transition-all duration-300 overflow-hidden ${isCompact ? 'cursor-pointer focus:outline-none' : ''}`}
      tabIndex={isCompact ? 0 : undefined}
    >
      {/* Background Decor or Image */}
      {latestImage ? (
        <>
          <img
            src={latestImage}
            alt={cycle.name}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity z-0 ${isCompact ? 'opacity-70 group-hover:opacity-90 group-focus:opacity-90' : 'opacity-80 group-hover:opacity-90'}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20 z-0" />
        </>
      ) : (
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
      )}

      {/* Header */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center relative z-10 transition-all duration-300 ${isCompact ? 'mb-0 group-hover:mb-6 group-focus:mb-6' : 'mb-6'}`}>
        <div>
          {/* Badges */}
          <div className={`${isCompact ? 'grid grid-rows-[0fr] group-hover:grid-rows-[1fr] group-focus:grid-rows-[1fr] transition-[grid-template-rows] duration-300' : ''}`}>
            <div className={`${isCompact ? 'overflow-hidden' : ''}`}>
              <div className={`flex items-center gap-2 mb-2 ${isCompact ? 'opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-300 delay-100' : ''}`}>
                {cycle.spaces && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase font-body ${latestImage ? 'bg-card-border backdrop-blur-md border-card-border/20 text-[#FAF9F6]' : 'glass-card text-brand-text border-white/20'}`}>
                    {cycle.spaces.name}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase font-body ${latestImage ? 'bg-card-border backdrop-blur-md border-card-border/20 text-[#FAF9F6]' : 'bg-brand-primary/20 text-brand-primary border-brand-primary/40 backdrop-blur-md'}`}>
                  Día {daysDiff}
                </span>
              </div>
            </div>
          </div>
          <h3 className={`text-2xl md:text-3xl font-light font-title ${latestImage ? 'text-[#FAF9F6]' : 'text-brand-text'}`}>{cycle.name}</h3>
        </div>

        {/* Link / Button */}
        <div className={`${isCompact ? 'grid grid-rows-[0fr] group-hover:grid-rows-[1fr] group-focus:grid-rows-[1fr] transition-[grid-template-rows] duration-300 w-full md:w-auto' : ''}`}>
          <div className={`${isCompact ? 'overflow-hidden w-full' : ''}`}>
            <Link
              href={`/cycles/${cycle.id}`}
              className={`mt-4 md:mt-0 bg-card text-foreground px-6 py-2 rounded-full text-sm font-bold font-body hover:bg-brand-primary hover:text-foreground transition-all shadow-sm shadow-brand-primary/10 flex items-center justify-center gap-2 ${isCompact ? 'opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-300 delay-100' : ''}`}
            >
              Ver Ciclo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Plants List */}
      <div className={`relative z-10 ${isCompact ? 'grid grid-rows-[0fr] group-hover:grid-rows-[1fr] group-focus:grid-rows-[1fr] transition-[grid-template-rows] duration-300' : ''}`}>
        <div className={`${isCompact ? 'overflow-hidden' : ''}`}>
          <div className={`${isCompact ? 'pt-6 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-300 delay-100' : ''}`}>
            <p className={`text-xs uppercase font-bold mb-3 font-body ${latestImage ? 'text-white/80' : 'text-muted'}`}>
              Plantas ({cycle.plants?.length || 0})
            </p>
            <div className="flex flex-wrap gap-2">
              {groupedPlants.length > 0 ? (
                groupedPlants.map((group) => (
                  <Link
                    key={group.id}
                    href={group.href}
                    className={`flex items-center gap-2 border rounded-full pr-3 pl-1 py-1 transition-colors group/badge ${latestImage ? 'bg-card-border backdrop-blur-md border-card-border/20 hover:border-card-border/40' : 'glass-card-interactive hover:border-brand-primary/50'}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${latestImage ? 'bg-card-border text-white group-hover/badge:bg-card/30' : 'bg-white/10 text-brand-text group-hover/badge:bg-brand-primary group-hover/badge:text-black'}`}>
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
      </div>

    </div>
  );
}
