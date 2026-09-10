"use client";

import { useState } from "react";
import { Warehouse } from "lucide-react";
import { Space } from "@/app/lib/types";
import SpaceCard from "@/components/SpaceCard";
import SpaceConfigModal from "@/components/SpaceConfigModal";
import EmptyState from "@/components/EmptyState";

export interface SpaceUsage {
  activeCycles: number;
  plants: number;
}

interface SpacesGridManagerProps {
  initialSpaces: Space[];
  usage: Record<number, SpaceUsage>;
}

export default function SpacesGridManager({ initialSpaces, usage }: SpacesGridManagerProps) {
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);

  return (
    <>
      {initialSpaces && initialSpaces.length > 0 ? (
        <ul className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {initialSpaces.map((space, i) => (
            <li key={space.id} style={{ ['--i' as string]: i }}>
              <SpaceCard
                space={space}
                activeCycles={usage[space.id]?.activeCycles ?? 0}
                plants={usage[space.id]?.plants ?? 0}
                onConfigure={() => setSelectedSpace(space)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Warehouse}
          title="Todavía no hay espacios"
          description="Un espacio es el lugar físico donde cultivás: una carpa, un armario o el exterior. Creá el primero para poder asignarle ciclos y llevar el registro de temperatura y humedad."
        />
      )}

      <SpaceConfigModal
        isOpen={!!selectedSpace}
        onClose={() => setSelectedSpace(null)}
        space={selectedSpace}
      />
    </>
  );
}
