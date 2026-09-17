"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Sprout } from "lucide-react";

import { bulkMoveToCycle } from "@/app/actions/plants";
import { Cycle } from "@/app/lib/types";
import { plantCountLabel } from "@/app/lib/utils";
import EmptyState from "./EmptyState";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";

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
      size="sm"
      dismissOnBackdrop={!loading}
      footer={
        cycles.length > 0 ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={close} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" form="bulk-move-cycle-form" className="btn btn-primary" disabled={loading}>
              {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {loading ? "Moviendo..." : "Mover plantas"}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={close}>
            Cerrar
          </button>
        )
      }
    >
      {cycles.length > 0 ? (
        <form id="bulk-move-cycle-form" onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="field-error" role="alert">
              <AlertCircle size={14} aria-hidden="true" />
              {error}
            </p>
          )}

          <div className="field">
            <label htmlFor="bulk-move-cycle" className="field-label">Ciclo de destino</label>
            <select
              id="bulk-move-cycle"
              data-autofocus
              required
              aria-invalid={error ? true : undefined}
              className="field-input"
              value={cycleId}
              onChange={(e) => {
                setCycleId(e.target.value);
                setError(null);
              }}
            >
              <option value="">Seleccionar ciclo...</option>
              {cycles.map(cycle => (
                <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
              ))}
              <option value={NO_CYCLE}>Sin ciclo</option>
            </select>
            <p className="field-hint">
              La etapa, la edad y la bitácora de cada planta viajan con ella.
            </p>
          </div>
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
