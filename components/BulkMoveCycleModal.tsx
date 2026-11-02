"use client";

import { useState } from "react";
import { Sprout } from "lucide-react";

import { bulkMoveToCycle } from "@/app/actions/plants";
import { Cycle } from "@/app/lib/types";
import { plantCountLabel } from "@/app/lib/utils";
import EmptyState from "./EmptyState";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";
import { ChoiceOrSelect, FormActions } from "@/components/ui/form";

/** Valor del desplegable para dejar las plantas sin ciclo. */
const NO_CYCLE = 'none';

interface BulkMoveCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: number[];
  onSuccess: () => void;
  cycles: Pick<Cycle, 'id' | 'name'>[];
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
}: BulkMoveCycleModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cycleId, setCycleId] = useState("");

  const close = () => {
    if (loading) return;
    setError(null);
    setCycleId("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cycleId) {
      setError("Elegí el ciclo de destino");
      return;
    }

    setLoading(true);
    setError(null);

    const target = cycleId === NO_CYCLE ? null : Number(cycleId);
    const res = await bulkMoveToCycle(selectedIds, target);

    setLoading(false);

    if (res.success) {
      const count = plantCountLabel(res.count ?? selectedIds.length);
      const destination = cycles.find(cycle => String(cycle.id) === cycleId)?.name;
      showToast(target === null ? `${count} quedaron sin ciclo` : `${count} movidas a ${destination}`);
      setCycleId("");
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
        cycles.length > 0 ? (
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
      {cycles.length > 0 ? (
        <form id="bulk-move-cycle-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
          <ChoiceOrSelect
            legend="Ciclo de destino"
            placeholder="Elegir ciclo…"
            options={[
              ...cycles.map(cycle => ({ value: String(cycle.id), label: cycle.name })),
              { value: NO_CYCLE, label: "Sin ciclo" },
            ]}
            value={cycleId || null}
            onChange={(value) => { setCycleId(value); setError(null); }}
            error={error}
            hint="La etapa, la edad y la bitácora de cada planta viajan con ella."
          />
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
