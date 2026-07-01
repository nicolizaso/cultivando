"use client";

import { useState } from "react";
import { Space } from "@/app/lib/types";
import SpaceCard from "@/components/SpaceCard";
import SpaceConfigModal from "@/components/SpaceConfigModal";
import { Warehouse } from "lucide-react";

interface SpacesGridManagerProps {
  initialSpaces: Space[];
}

export default function SpacesGridManager({ initialSpaces }: SpacesGridManagerProps) {
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {initialSpaces && initialSpaces.length > 0 ? (
          initialSpaces.map((space) => (
            <SpaceCard
              key={space.id}
              space={space}
              onClick={() => setSelectedSpace(space)}
            />
          ))
        ) : (
          <div className="col-span-full py-20 text-center border border-dashed border-card-border rounded-2xl bg-card">
            <Warehouse className="mx-auto text-muted mb-4" size={48} />
            <p className="text-muted">No hay espacios configurados.</p>
          </div>
        )}
      </div>

      <SpaceConfigModal
        isOpen={!!selectedSpace}
        onClose={() => setSelectedSpace(null)}
        space={selectedSpace}
      />
    </>
  );
}
