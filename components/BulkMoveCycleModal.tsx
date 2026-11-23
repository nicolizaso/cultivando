"use client";

import { useState } from "react";
import { Plus, Sprout } from "lucide-react";

import { bulkMoveToCycle } from "@/app/actions/plants";
import { createCycleWithSpace } from "@/app/cycles/actions";
import { todayForInput } from "@/app/lib/dates";
import { Cycle } from "@/app/lib/types";
import { plantCountLabel } from "@/app/lib/utils";
import EmptyState from "./EmptyState";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";
import { ChoiceOrSelect, Field, FormActions, Input, Select } from "@/components/ui/form";

/** Valor del desplegable para dejar las plantas sin ciclo. */
const NO_CYCLE = 'none';
/** Valor del desplegable para abrir un ciclo nuevo en el momento. */
const NEW_CYCLE = 'new';

interface BulkMoveCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: number[];
  onSuccess: () => void;
  cycles: Pick<Cycle, 'id' | 'name'>[];
  /** Si llegan espacios, se ofrece crear un ciclo nuevo como destino. */
  spaces?: { id: number; name: string }[];
  /** Espacio preelegido para el ciclo nuevo. */
  defaultSpaceId?: number | null;
}

/**
 * Cambia de ciclo varias plantas de una vez.
 *
 * Hasta ahora esto se hacía planta por planta, entrando a editar cada ficha,
 * que es justo lo que vuelve insufrible mudar una tanda de esquejes.
 */
export default function BulkMoveCycleModal({
  isOpen,
  onClose,
  selectedIds,
  onSuccess,
  cycles,
  spaces = [],
  defaultSpaceId = null,
}: BulkMoveCycleModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cycleId, setCycleId] = useState("");
  const [newName, setNewName] = useState("");
  const [newSpaceId, setNewSpaceId] = useState<number | ''>(defaultSpaceId ?? '');

  const canCreate = spaces.length > 0;
  const creating = cycleId === NEW_CYCLE;

  const reset = () => {
    setError(null);
    setCycleId("");
    setNewName("");
  };

  const close = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cycleId) {
      setError("Elegí el ciclo de destino");
      return;
    }

    if (creating) {
      if (!newName.trim()) return setError("Ponele un nombre al ciclo nuevo");
      if (!newSpaceId) return setError("Elegí en qué espacio va el ciclo nuevo");
    }

    setLoading(true);
    setError(null);

    let target: number | null = cycleId === NO_CYCLE ? null : Number(cycleId);
    let destination = cycles.find(cycle => String(cycle.id) === cycleId)?.name;

    if (creating) {
      const created = await createCycleWithSpace(newName, todayForInput(), Number(newSpaceId));
      if (!created.success || !created.cycleId) {
        setLoading(false);
        setError(created.error ?? "No se pudo crear el ciclo");
        return;
      }
      target = created.cycleId;
      destination = newName.trim();
    }

    const res = await bulkMoveToCycle(selectedIds, target);

    setLoading(false);

    if (res.success) {
      const count = plantCountLabel(res.count ?? selectedIds.length);
      showToast(target === null ? `${count} quedaron sin ciclo` : `${count} movidas a ${destination}`);
      reset();
      onSuccess();
      onClose();
    } else {
      setError(res.error ?? "No se pudieron mover las plantas");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Cambiar de ciclo"
      description={`${plantCountLabel(selectedIds.length)} pasan al ciclo que elijas.`}
      dismissOnBackdrop={!loading}
      footer={
        cycles.length > 0 || canCreate ? (
          <FormActions
            form="bulk-move-cycle-form"
            onCancel={close}
            pending={loading}
            pendingLabel="Moviendo…"
            submitLabel="Mover plantas"
          />
        ) : (
          <button type="button" className="btn btn-secondary w-full sm:ml-auto sm:w-auto" onClick={close}>
            Cerrar
          </button>
        )
      }
    >
      {cycles.length > 0 || canCreate ? (
        <form id="bulk-move-cycle-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
          <ChoiceOrSelect
            legend="Ciclo de destino"
            placeholder="Elegir ciclo…"
            options={[
              ...cycles.map(cycle => ({ value: String(cycle.id), label: cycle.name })),
              ...(canCreate ? [{ value: NEW_CYCLE, label: "Ciclo nuevo", icon: <Plus size={15} /> }] : []),
              { value: NO_CYCLE, label: "Sin ciclo" },
            ]}
            value={cycleId || null}
            onChange={(value) => { setCycleId(value); setError(null); }}
            error={error}
            hint="La etapa, la edad y la bitácora de cada planta viajan con ella."
          />

          {creating && (
            <div className="form-reveal grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombre del ciclo nuevo">
                <Input
                  type="text"
                  autoComplete="off"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setError(null); }}
                  placeholder="Ej: Esquejes noviembre"
                />
              </Field>
              <Field label="En qué espacio">
                <Select
                  value={newSpaceId}
                  onChange={(e) => { setNewSpaceId(e.target.value ? Number(e.target.value) : ''); setError(null); }}
                >
                  <option value="">Elegir espacio…</option>
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>{space.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
        </form>
      ) : (
        <EmptyState
          icon={Sprout}
          title="Todavía no hay ciclos"
          description="Creá un ciclo desde la sección Ciclos y después vas a poder mover plantas hacia él."
          className="p-5"
        />
      )}
    </Modal>
  );
}
