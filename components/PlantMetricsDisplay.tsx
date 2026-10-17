"use client";

import { useIsClient } from "@/app/hooks/useIsClient";
import { getPlantMetrics } from "@/app/lib/utils";
import { Plant } from "@/app/lib/types";

interface PlantMetricsDisplayProps {
  plant: Plant;
  type: 'totalAge' | 'daysInCurrentStage';
}

export default function PlantMetricsDisplay({ plant, type }: PlantMetricsDisplayProps) {
  // Los días dependen de "hoy": se muestran recién en el navegador.
  const isMounted = useIsClient();

  const metrics = getPlantMetrics(plant);
  const value = type === 'totalAge' ? metrics.totalAge : metrics.daysInCurrentStage;

  if (!isMounted) {
    return <span className="opacity-0">0</span>;
  }

  return <>{value}</>;
}
