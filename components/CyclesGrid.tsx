"use client";

import { useMemo, useState } from "react";
import { Sprout } from "lucide-react";
import CycleCard, { type CycleWithSpace } from "@/components/CycleCard";
import EmptyState from "@/components/EmptyState";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { Space } from "@/app/lib/types";

type Scope = 'active' | 'finished' | 'all';

interface CyclesGridProps {
  cycles: CycleWithSpace[];
  /** Plantas vivas por ciclo, calculado en el servidor. */
  plantCounts: Record<number, number>;
  /** Día de cultivo por ciclo, calculado en el servidor. */
  days: Record<number, number>;
  /** Espacios del usuario: destinos para mudar un ciclo desde su tarjeta. */
  spaces: Pick<Space, 'id' | 'name' | 'type'>[];
}

/**
 * La lista mezclaba ciclos en curso y cerrados sin manera de separarlos: los
 * finalizados sólo se distinguían por una opacidad, que en la práctica no
 * ayudaba cuando había más de dos o tres tandas.
 */
export default function CyclesGrid({ cycles, plantCounts, days, spaces }: CyclesGridProps) {
  const [scope, setScope] = useState<Scope>('active');

  const activeCount = useMemo(() => cycles.filter(c => c.is_active).length, [cycles]);
  const finishedCount = cycles.length - activeCount;

  const visible = useMemo(() => {
    if (scope === 'all') return cycles;
    return cycles.filter(c => (scope === 'active' ? c.is_active : !c.is_active));
  }, [cycles, scope]);

  if (cycles.length === 0) {
    return (
      <EmptyState
        icon={Sprout}
        title="Todavía no hay ciclos"
        description="Un ciclo agrupa las plantas que cultivás juntas en un espacio: le pone fecha de arranque al cultivo y es donde se registran fotos, mediciones y cambios de etapa."
      />
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SegmentedControl<Scope>
          label="Estado de los ciclos"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'active', label: 'En curso', count: activeCount },
            { value: 'finished', label: 'Finalizados', count: finishedCount },
            { value: 'all', label: 'Todos', count: cycles.length },
          ]}
        />
      </div>

      {visible.length > 0 ? (
        <ul className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((cycle, i) => (
            <li key={cycle.id} style={{ ['--i' as string]: i }}>
              <CycleCard
                cycle={cycle}
                days={days[cycle.id] ?? 0}
                plantCount={plantCounts[cycle.id] ?? 0}
                spaces={spaces}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Sprout}
          title={scope === 'active' ? "Ningún ciclo en curso" : "Ningún ciclo finalizado"}
          description={
            scope === 'active'
              ? "Todos tus ciclos están cerrados. Iniciá uno nuevo para volver a registrar el día a día."
              : "Cuando cierres un ciclo va a quedar guardado acá con todo su historial."
          }
        />
      )}
    </div>
  );
}
