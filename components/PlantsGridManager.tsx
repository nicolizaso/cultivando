"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, CheckSquare, Filter, FilterX, Search, Sprout, Square, Trash2, X } from "lucide-react";

import PlantCard from "./plantcard";
import { supabase } from "@/app/lib/supabase";
import { Plant as BasePlant, Cycle, Space } from "@/app/lib/types";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import SegmentedControl from "@/components/ui/SegmentedControl";
import SelectionBar from "@/components/ui/SelectionBar";
import { useToast } from "@/app/context/ToastContext";

interface Plant extends BasePlant {
  cycles?: { id: number; name: string; space_id: number } | null;
}

interface PlantsGridManagerProps {
  plants: Plant[];
  cycles: Pick<Cycle, 'id' | 'name' | 'space_id'>[];
  spaces: Pick<Space, 'id' | 'name'>[];
}

type Scope = 'active' | 'archived';

/** Compara ignorando mayúsculas y tildes: "plátano" encuentra "platano". */
const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export default function PlantsGridManager({ plants, cycles, spaces }: PlantsGridManagerProps) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [scope, setScope] = useState<Scope>('active');
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCycleId, setSelectedCycleId] = useState<string>("all");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>("all");

  const router = useRouter();
  const { showToast } = useToast();

  const activeCount = useMemo(() => plants.filter(p => !p.is_archived).length, [plants]);
  const archivedCount = plants.length - activeCount;

  const filteredPlants = useMemo(() => {
    const term = normalize(query);

    return plants.filter(plant => {
      // Archivadas y activas son conjuntos excluyentes, nunca una mezcla.
      if (scope === 'archived' ? plant.is_archived !== true : Boolean(plant.is_archived)) return false;

      if (selectedCycleId !== "all" && plant.cycle_id !== Number(selectedCycleId)) return false;

      if (selectedSpaceId !== "all") {
        // Sin ciclo no hay espacio asignado, así que no puede coincidir.
        if (!plant.cycles) return false;
        if (plant.cycles.space_id !== Number(selectedSpaceId)) return false;
      }

      if (term) {
        const haystack = normalize(`${plant.name ?? ''} ${plant.strain ?? ''} ${plant.cycles?.name ?? ''}`);
        if (!haystack.includes(term)) return false;
      }

      return true;
    });
  }, [plants, scope, query, selectedCycleId, selectedSpaceId]);

  const togglePlantSelection = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const isAllSelected = filteredPlants.length > 0 && filteredPlants.every(p => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    const newSelected = new Set(selectedIds);
    if (isAllSelected) filteredPlants.forEach(p => newSelected.delete(p.id));
    else filteredPlants.forEach(p => newSelected.add(p.id));
    setSelectedIds(newSelected);
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('plants')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      showToast(`${selectedIds.size} plantas eliminadas`);
      exitSelectionMode();
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudieron eliminar las plantas", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const clearFilters = () => {
    setSelectedCycleId("all");
    setSelectedSpaceId("all");
  };

  const hasFilters = selectedCycleId !== "all" || selectedSpaceId !== "all";
  const isNarrowed = hasFilters || query.trim().length > 0;

  return (
    <div>
      {/* Barra de herramientas: buscar, acotar, filtrar. En ese orden, y una
          sola fila en escritorio. */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 md:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o genética"
            aria-label="Buscar plantas"
            className="field-input pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          <SegmentedControl<Scope>
            label="Estado de las plantas"
            value={scope}
            onChange={(next) => { setScope(next); exitSelectionMode(); }}
            options={[
              { value: 'active', label: 'Activas', count: activeCount },
              { value: 'archived', label: 'Archivadas', icon: Archive, count: archivedCount },
            ]}
          />

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls="plants-filters"
            className={`btn btn-sm ${showFilters || hasFilters ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Filter size={15} aria-hidden="true" />
            Filtros
            {hasFilters && <span className="mono text-[11px]">{[selectedCycleId, selectedSpaceId].filter(v => v !== 'all').length}</span>}
          </button>

          <button
            type="button"
            onClick={() => (isSelectionMode ? exitSelectionMode() : setIsSelectionMode(true))}
            aria-pressed={isSelectionMode}
            className="btn btn-sm btn-secondary"
          >
            {isSelectionMode ? <X size={15} aria-hidden="true" /> : <CheckSquare size={15} aria-hidden="true" />}
            {isSelectionMode ? 'Cancelar' : 'Seleccionar'}
          </button>
        </div>
      </div>

      {showFilters && (
        <div id="plants-filters" className="surface animate-fade-in mb-4 rounded-[var(--radius-lg)] p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <button type="button" onClick={clearFilters} className="btn btn-sm btn-ghost">
                <FilterX size={15} aria-hidden="true" />
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-line pb-3">
        <p className="text-sm text-fg-muted" aria-live="polite">
          <span className="mono font-semibold text-fg">{filteredPlants.length}</span>{' '}
          {filteredPlants.length === 1 ? 'planta' : 'plantas'}
          {isNarrowed && <span className="text-fg-subtle"> de {scope === 'archived' ? archivedCount : activeCount}</span>}
        </p>

        {isSelectionMode && (
          <button type="button" onClick={toggleSelectAll} className="btn btn-sm btn-ghost ml-auto">
            {isAllSelected ? <Square size={15} aria-hidden="true" /> : <CheckSquare size={15} aria-hidden="true" />}
            {isAllSelected ? 'Quitar todas' : 'Seleccionar todas'}
          </button>
        )}
      </div>

      {filteredPlants.length > 0 ? (
        <ul className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPlants.map((plant, i) => (
            <li key={plant.id} style={{ ['--i' as string]: i }}>
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
          icon={isNarrowed ? Search : scope === 'archived' ? Archive : Sprout}
          title={
            isNarrowed
              ? "Sin resultados"
              : scope === 'archived'
                ? "Sin plantas archivadas"
                : "Todavía no hay plantas"
          }
          description={
            isNarrowed
              ? "Ninguna planta coincide con lo que buscás. Probá quitando algún filtro."
              : scope === 'archived'
                ? "Las plantas que archives desde un ciclo van a aparecer acá, con su historial intacto."
                : "Creá tu primera planta y elegí en qué ciclo entra. Desde ahí se registran riegos, etapas y fotos."
          }
          action={
            isNarrowed ? (
              <button
                type="button"
                onClick={() => { setQuery(''); clearFilters(); }}
                className="btn btn-secondary"
              >
                <FilterX size={16} aria-hidden="true" />
                Limpiar búsqueda
              </button>
            ) : undefined
          }
        />
      )}

      <SelectionBar
        count={isSelectionMode ? selectedIds.size : 0}
        onClear={exitSelectionMode}
        label="Acciones sobre las plantas seleccionadas"
      >
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isDeleting}
          className="btn btn-sm btn-danger rounded-full"
        >
          <Trash2 size={15} aria-hidden="true" />
          {isDeleting ? "Eliminando..." : "Eliminar"}
        </button>
      </SelectionBar>

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
