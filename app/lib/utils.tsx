import { Plant } from './types';
import { Dna, Droplets, Flower2, Leaf, Package, Sprout, Wind, HelpCircle } from 'lucide-react';

export function formatDateShort(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);

  // Check for invalid date
  if (isNaN(date.getTime())) return dateString;

  // Use es-ES locale for dd/mm/yy format
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  });
}

/**
 * Paleta de etapas basada en tokens: cada etapa define su color en :root y en
 * .dark (ver globals.css), así el mismo componente mantiene contraste AA en
 * ambos temas. Los iconos son vectoriales y decorativos (el texto de la etapa
 * siempre acompaña), por eso van con aria-hidden.
 */
const stageIconProps = {
  className: 'w-[1em] h-[1em] shrink-0',
  'aria-hidden': true,
} as const;

/* Las clases se escriben completas y literales: Tailwind escanea texto y no
   resuelve nombres construidos por interpolación. */
const STAGE_STYLES = {
  bloom: {
    bgColor: 'bg-[color:var(--stage-bloom-soft)]',
    textColor: 'text-[color:var(--stage-bloom)]',
    borderColor: 'border-[color:color-mix(in_srgb,var(--stage-bloom)_35%,transparent)]',
    accent: 'var(--stage-bloom)',
  },
  veg: {
    bgColor: 'bg-[color:var(--stage-veg-soft)]',
    textColor: 'text-[color:var(--stage-veg)]',
    borderColor: 'border-[color:color-mix(in_srgb,var(--stage-veg)_35%,transparent)]',
    accent: 'var(--stage-veg)',
  },
  root: {
    bgColor: 'bg-[color:var(--stage-root-soft)]',
    textColor: 'text-[color:var(--stage-root)]',
    borderColor: 'border-[color:color-mix(in_srgb,var(--stage-root)_35%,transparent)]',
    accent: 'var(--stage-root)',
  },
  seed: {
    bgColor: 'bg-[color:var(--stage-seed-soft)]',
    textColor: 'text-[color:var(--stage-seed)]',
    borderColor: 'border-[color:color-mix(in_srgb,var(--stage-seed)_35%,transparent)]',
    accent: 'var(--stage-seed)',
  },
  germ: {
    bgColor: 'bg-[color:var(--stage-germ-soft)]',
    textColor: 'text-[color:var(--stage-germ)]',
    borderColor: 'border-[color:color-mix(in_srgb,var(--stage-germ)_35%,transparent)]',
    accent: 'var(--stage-germ)',
  },
  dry: {
    bgColor: 'bg-[color:var(--stage-dry-soft)]',
    textColor: 'text-[color:var(--stage-dry)]',
    borderColor: 'border-[color:color-mix(in_srgb,var(--stage-dry)_35%,transparent)]',
    accent: 'var(--stage-dry)',
  },
  cure: {
    bgColor: 'bg-[color:var(--stage-cure-soft)]',
    textColor: 'text-[color:var(--stage-cure)]',
    borderColor: 'border-[color:color-mix(in_srgb,var(--stage-cure)_35%,transparent)]',
    accent: 'var(--stage-cure)',
  },
  none: {
    bgColor: 'bg-[color:var(--stage-none-soft)]',
    textColor: 'text-[color:var(--stage-none)]',
    borderColor: 'border-[color:color-mix(in_srgb,var(--stage-none)_35%,transparent)]',
    accent: 'var(--stage-none)',
  },
} as const;

export function getStageColor(stage?: string) {
  const s = stage?.toLowerCase() || '';

  if (s === 'floración' || s === 'floracion') {
    return { ...STAGE_STYLES.bloom, icon: <Flower2 {...stageIconProps} /> };
  }

  if (s === 'vegetativo' || s === 'vegetacion') {
    return { ...STAGE_STYLES.veg, icon: <Leaf {...stageIconProps} /> };
  }

  if (s === 'enraizamiento') {
    return { ...STAGE_STYLES.root, icon: <Dna {...stageIconProps} /> };
  }

  if (s === 'plántula' || s === 'plantula' || s === 'esqueje') {
    return { ...STAGE_STYLES.seed, icon: <Sprout {...stageIconProps} /> };
  }

  if (s === 'germinación' || s === 'germinacion') {
    return { ...STAGE_STYLES.germ, icon: <Droplets {...stageIconProps} /> };
  }

  if (s === 'secado') {
    return { ...STAGE_STYLES.dry, icon: <Wind {...stageIconProps} /> };
  }

  if (s === 'curado') {
    return { ...STAGE_STYLES.cure, icon: <Package {...stageIconProps} /> };
  }

  return { ...STAGE_STYLES.none, icon: <HelpCircle {...stageIconProps} /> };
}

export function getPlantMetrics(plant: Plant) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Order matters: prioritize later stages
  const stages = [
    { key: 'date_curado', label: 'Curado' },
    { key: 'date_secado', label: 'Secado' },
    { key: 'date_floracion', label: 'Floración' },
    { key: 'date_vegetativo', label: 'Vegetativo' },
    { key: 'date_enraizamiento', label: 'Enraizamiento' },
    { key: 'date_plantula', label: 'Plántula' },
    { key: 'date_germinacion', label: 'Germinación' }
  ];

  let currentStage = plant.stage; // Default to existing stage if no dates found
  let stageDate: Date | null = null;

  // 1. Determine Current Stage based on highest date set
  for (const stage of stages) {
    // @ts-ignore
    const dateStr = plant[stage.key];
    if (dateStr) {
      currentStage = stage.label;
      stageDate = new Date(dateStr);
      break;
    }
  }

  // If no stage date found but planted_at exists, maybe fallback logic?
  // For now, if no date found, we stick with plant.stage but have no start date.

  // 2. Calculate Days in Current Stage
  let daysInCurrentStage = 0;
  if (stageDate) {
      // normalize
      const d = new Date(stageDate);
      d.setHours(0,0,0,0);
      const diffTime = today.getTime() - d.getTime();
      daysInCurrentStage = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // 3. Calculate Total Age (from earliest date available)
  let earliestDate: Date | null = null;
  const allDates = [
      plant.date_germinacion,
      plant.date_plantula,
      plant.date_enraizamiento,
      plant.date_vegetativo,
      plant.date_floracion,
      plant.date_secado,
      plant.date_curado,
      plant.planted_at
  ].filter(d => d).map(d => new Date(d as string));

  if (allDates.length > 0) {
      allDates.sort((a, b) => a.getTime() - b.getTime());
      earliestDate = allDates[0];
  }

  let totalAge = 0;
  if (earliestDate) {
      const e = new Date(earliestDate);
      e.setHours(0,0,0,0);
      const diffTime = today.getTime() - e.getTime();
      totalAge = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  return {
      currentStage,
      daysInCurrentStage,
      totalAge
  };
}

export function mapTaskCycles(t: any, allCycles?: { id: number; name: string }[]): { cycleIds: number[], cycleNames: string } {
    const cycleIdsSet = new Set<number>();
    const cycleNamesSet = new Set<string>();

    if (t.task_cycles && t.task_cycles.length > 0) {
        t.task_cycles.forEach((tc: any) => {
            if (tc.cycles) {
                cycleIdsSet.add(tc.cycles.id);
                cycleNamesSet.add(tc.cycles.name);
            }
        });
    }

    if (t.task_plants && t.task_plants.length > 0) {
        t.task_plants.forEach((tp: any) => {
            if (tp.plants?.cycles) {
                cycleIdsSet.add(tp.plants.cycles.id);
                cycleNamesSet.add(tp.plants.cycles.name);
            }
        });
    }

    // Legacy fallback
    if (t.cycle_id) {
        cycleIdsSet.add(t.cycle_id);
        if (allCycles) {
            const matchingCycle = allCycles.find((c: any) => c.id === t.cycle_id);
            if (matchingCycle) cycleNamesSet.add(matchingCycle.name);
        } else if (t.cycles && typeof t.cycles === 'object') {
            cycleNamesSet.add(t.cycles.name);
        }
    }

    return {
      cycleIds: Array.from(cycleIdsSet),
      cycleNames: Array.from(cycleNamesSet).join(', ')
    };
}

/**
 * Días desde el último riego.
 *
 * `last_water` es heterogéneo por herencia: la tarjeta de planta guarda la
 * cadena "Hoy" al regar desde el menú rápido, mientras que el resto del flujo
 * guarda una fecha ISO. Un único lector resuelve los dos casos en vez de
 * repartir la corrección por cada pantalla.
 *
 * Devuelve null cuando no hay registro de riego.
 */
export function getDaysSinceWater(lastWater?: string | null): number | null {
  if (!lastWater) return null;
  if (lastWater === 'Hoy') return 0;

  const watered = new Date(lastWater);
  if (isNaN(watered.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  watered.setHours(0, 0, 0, 0);

  return Math.max(0, Math.round((today.getTime() - watered.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Estado del riego traducido a lenguaje y severidad.
 *
 * El color nunca viaja solo: cada nivel trae también su texto, para que el
 * atraso se entienda sin distinguir tonos.
 */
export function getWaterStatus(lastWater?: string | null) {
  const days = getDaysSinceWater(lastWater);

  if (days === null) return { days, label: 'Sin registro', level: 'unknown' as const };
  if (days === 0) return { days, label: 'Regada hoy', level: 'ok' as const };
  if (days === 1) return { days, label: 'Regada ayer', level: 'ok' as const };
  if (days <= 2) return { days, label: `Hace ${days} días`, level: 'ok' as const };
  if (days === 3) return { days, label: 'Hace 3 días', level: 'warn' as const };

  return { days, label: `Hace ${days} días`, level: 'late' as const };
}

/**
 * Días transcurridos desde una fecha, sin decimales ni negativos.
 *
 * Se calcula siempre en el servidor y se pasa ya resuelto a las tarjetas: si
 * cada componente de cliente llamara a "ahora" durante el render, en el cambio
 * de día el HTML del servidor y el del navegador dirían números distintos.
 */
export function daysSince(dateString?: string | null): number {
  if (!dateString) return 0;

  const start = new Date(dateString);
  if (isNaN(start.getTime())) return 0;

  return Math.max(0, Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}
