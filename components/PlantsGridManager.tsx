"use client";

import { useState, useMemo } from "react";
import PlantCard from "./plantcard";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { CheckSquare, Square, Trash2, X, FilterX, Filter, Archive, Sprout } from "lucide-react";
import { Plant as BasePlant, Cycle, Space } from "@/app/lib/types";
import AddPlantModal from "./AddPlantModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/app/context/ToastContext";

interface Plant extends BasePlant {
  cycles?: { id: number; name: string; space_id: number } | null;
}

interface PlantsGridManagerProps {
  plants: Plant[];
  cycles: Pick<Cycle, 'id' | 'name' | 'space_id'>[];
  spaces: Pick<Space, 'id' | 'name'>[];
}

export default function PlantsGridManager({ plants, cycles, spaces }: PlantsGridManagerProps) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCycleId, setSelectedCycleId] = useState<string>("all");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);

  const router = useRouter();
  const { showToast } = useToast();

  // Filter Logic
  const filteredPlants = useMemo(() => {
    return plants.filter(plant => {
      // Filter by Archive State
      if (showArchived) {
          if (plant.is_archived !== true) return false;
      } else {
          if (plant.is_archived) return false;
      }

      // Filter by Cycle
      if (selectedCycleId !== "all") {
        if (plant.cycle_id !== Number(selectedCycleId)) return false;
      }

      // Filter by Space
      if (selectedSpaceId !== "all") {
        // If the plant has no cycle, it conceptually has no space assignment in this context
        if (!plant.cycles) return false;
        if (plant.cycles.space_id !== Number(selectedSpaceId)) return false;
      }

      return true;
    });
  }, [plants, selectedCycleId, selectedSpaceId]);

  // Toggle Selection Mode
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set()); // Clear selection when toggling
  };

  // Toggle Individual Plant Selection
  const togglePlantSelection = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Select All / Deselect All
  const toggleSelectAll = () => {
    // Determine if all *filtered* plants are selected
    const allFilteredSelected = filteredPlants.length > 0 && filteredPlants.every(p => selectedIds.has(p.id));

    if (allFilteredSelected) {
        // Deselect only the filtered plants
        const newSelected = new Set(selectedIds);
        filteredPlants.forEach(p => newSelected.delete(p.id));
        setSelectedIds(newSelected);
    } else {
        // Select all filtered plants
        const newSelected = new Set(selectedIds);
        filteredPlants.forEach(p => newSelected.add(p.id));
        setSelectedIds(newSelected);
    }
  }

  // Helper to check if all filtered are selected
  const isAllSelected = filteredPlants.length > 0 && filteredPlants.every(p => selectedIds.has(p.id));

  // Bulk Delete
  const handleDelete = async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('plants')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      // Reset state and refresh
      showToast(`${selectedIds.size} plantas eliminadas`);
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudieron eliminar las plantas", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Clear Filters
  const clearFilters = () => {
    setSelectedCycleId("all");
    setSelectedSpaceId("all");
  };

  const hasFilters = selectedCycleId !== "all" || selectedSpaceId !== "all";

  return (
    <div>
      {/* Barra de herramientas */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <p className="text-sm text-fg-muted" aria-live="polite">
          <span className="font-semibold text-fg">{filteredPlants.length}</span>{' '}
          {filteredPlants.length === 1 ? 'planta' : 'plantas'}
          {hasFilters && <span> (filtrado de {plants.length})</span>}
        </p>

        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            aria-pressed={showArchived}
            className={showArchived ? "btn btn-primary h-10 min-h-10 px-3" : "btn btn-secondary h-10 min-h-10 px-3"}
          >
            <Archive size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Archivadas</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls="plants-filters"
            className={showFilters || hasFilters ? "btn btn-primary h-10 min-h-10 px-3" : "btn btn-secondary h-10 min-h-10 px-3"}
          >
            <Filter size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Filtros</span>
          </button>

          <AddPlantModal />

          {isSelectionMode && (
            <button type="button" onClick={toggleSelectAll} className="btn btn-secondary h-10 min-h-10 px-3">
              {isAllSelected ? <CheckSquare size={16} aria-hidden="true" /> : <Square size={16} aria-hidden="true" />}
              <span className="hidden md:inline">{isAllSelected ? "Deseleccionar" : "Todas"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleSelectionMode}
            aria-pressed={isSelectionMode}
            className="btn btn-secondary h-10 min-h-10 px-3"
          >
            {isSelectionMode ? "Cancelar" : "Seleccionar"}
          </button>
        </div>
      </div>

      {showFilters && (
        <div id="plants-filters" className="surface animate-fade-in mb-6 rounded-[var(--radius-lg)] p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="field">
              <label htmlFor="filter-space" className="field-label">Espacio</label>
              <select
                id="filter-space"
                value={selectedSpaceId}
                onChange={(e) => setSelectedSpaceId(e.target.value)}
                className="field-input"
              >
                <option value="all">Todos los espacios</option>
                {spaces.map(space => (
                  <option key={space.id} value={space.id}>{space.name}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="filter-cycle" className="field-label">Ciclo</label>
              <select
                id="filter-cycle"
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
                className="field-input"
              >
                <option value="all">Todos los ciclos</option>
                {cycles.map(cycle => (
                  <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
                ))}
              </select>
            </div>
          </div>

          {hasFilters && (
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={clearFilters} className="btn btn-ghost h-10 min-h-10 px-3 text-xs">
                <FilterX size={16} aria-hidden="true" />
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {filteredPlants.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPlants.map((plant) => (
            <li key={plant.id}>
              <PlantCard
                plant={plant}
                cycleName={plant.cycles?.name}
                selectionMode={isSelectionMode}
                isSelected={selectedIds.has(plant.id)}
                onToggleSelection={() => togglePlantSelection(plant.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Sprout}
          title={hasFilters ? "Sin resultados" : showArchived ? "Sin plantas archivadas" : "Sin plantas"}
          description={
            hasFilters
              ? "Ninguna planta coincide con los filtros aplicados. Probá quitando alguno."
              : showArchived
                ? "Las plantas que archives desde un ciclo van a aparecer acá."
                : "Todavía no hay plantas registradas. Creá una desde un ciclo activo."
          }
        />
      )}

      {isSelectionMode && selectedIds.size > 0 && (
        <div
          role="toolbar"
          aria-label="Acciones sobre las plantas seleccionadas"
          className="animate-sheet-in surface fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full p-2 pl-4 shadow-[var(--shadow-lg)] md:bottom-8"
        >
          <span className="whitespace-nowrap text-sm font-semibold text-fg" aria-live="polite">
            {selectedIds.size} seleccionadas
          </span>

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            className="btn btn-danger h-10 min-h-10 rounded-full px-4 text-xs"
          >
            <Trash2 size={16} aria-hidden="true" />
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </button>

          <button
            type="button"
            onClick={() => { setSelectedIds(new Set()); setIsSelectionMode(false); }}
            className="btn-icon h-10 min-h-10 w-10 min-w-10"
            aria-label="Salir del modo selección"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Eliminar plantas"
        description={`Se eliminarán ${selectedIds.size} plantas y su historial. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
