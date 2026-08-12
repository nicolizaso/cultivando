"use client";

import { useState } from "react";
import { Space } from "@/app/lib/types";
import SpaceCard from "@/components/SpaceCard";
import SpaceConfigModal from "@/components/SpaceConfigModal";
import EmptyState from "@/components/EmptyState";
import { Warehouse } from "lucide-react";

interface SpacesGridManagerProps {
  initialSpaces: Space[];
}

export default function SpacesGridManager({ initialSpaces }: SpacesGridManagerProps) {
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);

  return (
    <>
      {initialSpaces && initialSpaces.length > 0 ? (
        <ul className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {initialSpaces.map((space, i) => (
            <li key={space.id} style={{ ['--i' as string]: i }}>
              <SpaceCard space={space} onClick={() => setSelectedSpace(space)} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Warehouse}
          title="Sin espacios"
          description="Un espacio es el lugar físico donde cultivás: una carpa, un armario o el exterior. Creá el primero para asignarle ciclos."
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
