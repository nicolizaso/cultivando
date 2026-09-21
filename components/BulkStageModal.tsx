"use client";

import { useState } from "react";
import { ArrowRightCircle, Loader2 } from "lucide-react";

import { bulkChangeStage } from "@/app/actions/plants";
import { STAGE_NAMES } from "@/app/lib/stage-logic";
import { plantCountLabel, todayForInput } from "@/app/lib/utils";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";

interface BulkStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: number[];
  onSuccess: () => void;
}

export default function BulkStageModal({ isOpen, onClose, selectedIds, onSuccess }: BulkStageModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string>("Floración");
  const [date, setDate] = useState(todayForInput);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // La fecha va cruda: el servidor la ancla al mediodía para que no se corra
    // de día al convertirla.
    const res = await bulkChangeStage(selectedIds, stage, date);

    setLoading(false);

    if (res.success) {
      showToast(`Etapa actualizada a ${stage} en ${plantCountLabel(res.count ?? selectedIds.length)}`);
      onSuccess();
      onClose();
    } else {
      showToast(res.error || "No se pudo cambiar la etapa", "error");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cambio de etapa"
      description={`Se moverá ${plantCountLabel(selectedIds.length)}.`}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="bulk-stage-form" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <ArrowRightCircle size={16} aria-hidden="true" />
            )}
            {loading ? "Procesando..." : "Cambiar etapa"}
          </button>
        </>
      }
    >
      <form id="bulk-stage-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="field">
          <label htmlFor="bulk-stage-select" className="field-label">Nueva etapa</label>
          <select
            id="bulk-stage-select"
            data-autofocus
            className="field-input"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            {STAGE_NAMES.map((label) => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="bulk-stage-date" className="field-label">Fecha del cambio</label>
          <input
            id="bulk-stage-date"
            type="date"
            required
            className="field-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <p className="field-hint">La edad en etapa se cuenta desde esta fecha.</p>
        </div>
      </form>
    </Modal>
  );
}
