"use client";

import { useState, useMemo } from "react";
import PlantCard from "./plantcard";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { CheckSquare, Square, Trash2, X, FilterX, Filter, Archive } from "lucide-react";
import { Plant as BasePlant, Cycle, Space } from "@/app/lib/types";
import AddPlantModal from "./AddPlantModal";

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

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCycleId, setSelectedCycleId] = useState<string>("all");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);

  const router = useRouter();

  // Filter Logic
  const filteredPlants = useMemo(() => {
    return plants.filter(plant => {
      // Filter by Archive State
      if (showArchived) {
          if (!plant.is_archived) return false;
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

    const confirm = window.confirm(`¿Estás seguro de que deseas eliminar ${selectedIds.size} plantas? Esta acción no se puede deshacer.`);
    if (!confirm) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('plants')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      // Reset state and refresh
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      router.refresh();
    } catch (error) {
      console.error("Error deleting plants:", error);
      alert("Error al eliminar las plantas seleccionadas.");
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
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
         <div className="text-sm text-muted font-bold">
            {filteredPlants.length} plantas {hasFilters && <span className="text-muted font-normal">(filtrado de {plants.length})</span>}
         </div>

         <div className="flex gap-2 self-end md:self-auto">
            <button
                onClick={() => setShowArchived(!showArchived)}
                className={`p-2 rounded-lg transition-colors ${
                    showArchived
                    ? "bg-brand-primary text-brand-bg shadow-sm shadow-brand-primary/20"
                    : "bg-card-border hover:bg-card-border text-muted hover:text-foreground"
                }`}
                title="Mostrar Archivadas"
            >
                <Archive size={20} />
            </button>

            <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${
                    showFilters || hasFilters
                    ? "bg-brand-primary text-brand-bg shadow-sm shadow-brand-primary/20"
                    : "bg-card-border hover:bg-card-border text-muted hover:text-foreground"
                }`}
                title="Filtrar"
            >
                <Filter size={20} />
            </button>

            <AddPlantModal />

            {isSelectionMode && (
                <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card-border hover:bg-card-border text-foreground text-xs font-bold uppercase transition-colors"
                >
                    {isAllSelected ? <CheckSquare size={16}/> : <Square size={16}/>}
                    <span className="hidden md:inline">{isAllSelected ? "Deseleccionar" : "Todos"}</span>
                </button>
            )}

            <button
                onClick={toggleSelectionMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${
                    isSelectionMode
                    ? "bg-card-border text-foreground border border-slate-300"
                    : "bg-card-border hover:bg-card-border text-foreground border border-transparent"
                }`}
            >
                {isSelectionMode ? "Cancelar" : "Seleccionar"}
            </button>
         </div>
      </div>

      {/* Collapsible Filter Section */}
      {showFilters && (
        <div className="bg-card p-4 rounded-2xl mb-6 animate-in fade-in slide-in-from-top-2 border border-card-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Space Filter */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted font-bold uppercase ml-1">Espacio</label>
                    <select
                        value={selectedSpaceId}
                        onChange={(e) => setSelectedSpaceId(e.target.value)}
                        className="w-full bg-background text-foreground text-sm border border-card-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-primary/50 transition-colors appearance-none cursor-pointer"
                    >
                        <option value="all">Todos los espacios</option>
                        {spaces.map(space => (
                            <option key={space.id} value={space.id}>{space.name}</option>
                        ))}
                    </select>
                </div>

                {/* Cycle Filter */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted font-bold uppercase ml-1">Ciclo</label>
                    <select
                        value={selectedCycleId}
                        onChange={(e) => setSelectedCycleId(e.target.value)}
                        className="w-full bg-background text-foreground text-sm border border-card-border rounded-lg px-3 py-2 focus:outline-none focus:border-brand-primary/50 transition-colors appearance-none cursor-pointer"
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
                    <button
                        onClick={clearFilters}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-muted hover:text-foreground bg-card-border hover:bg-card-border rounded-lg transition-colors"
                    >
                        <FilterX size={16} />
                        Limpiar Filtros
                    </button>
                </div>
            )}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPlants.length > 0 ? (
          filteredPlants.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              cycleName={plant.cycles?.name}
              selectionMode={isSelectionMode}
              isSelected={selectedIds.has(plant.id)}
              onToggleSelection={() => togglePlantSelection(plant.id)}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-20 bg-card rounded-2xl border border-dashed border-card-border">
            <p className="text-muted font-body">
                {hasFilters ? "No se encontraron plantas con estos criterios." : "No hay plantas registradas en ningún ciclo."}
            </p>
          </div>
        )}
      </div>

      {/* Floating Action Bar */}
      {isSelectionMode && selectedIds.size > 0 && (
          <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-card border border-card-border p-2 rounded-full shadow-sm shadow-black/80 animate-in slide-in-from-bottom-4 fade-in">
              <span className="pl-4 text-sm font-bold text-foreground whitespace-nowrap">
                  {selectedIds.size} seleccionadas
              </span>
              <div className="w-px h-6 bg-card-border"></div>
              <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-colors"
              >
                  {isDeleting ? "Eliminando..." : (
                      <>
                        <Trash2 size={16} /> Eliminar
                      </>
                  )}
              </button>
              <button
                  onClick={() => { setSelectedIds(new Set()); setIsSelectionMode(false); }}
                  className="bg-card-border hover:bg-card-border text-muted p-2 rounded-full transition-colors"
              >
                  <X size={20} />
              </button>
          </div>
      )}
    </div>
  );
}
