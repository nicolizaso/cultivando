"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkChangeStage } from "@/app/cycles/actions";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";

const stageColumnMap: Record<string, string> = {
  'Germinación': 'date_germinacion',
  'Plántula': 'date_plantula',
  'Enraizamiento': 'date_enraizamiento',
  'Vegetativo': 'date_vegetativo',
  'Floración': 'date_floracion',
  'Secado': 'date_secado',
  'Curado': 'date_curado'
};

interface BulkStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: number[];
  onSuccess: () => void;
  cycleId: number;
}

export default function BulkStageModal({ isOpen, onClose, selectedIds, onSuccess, cycleId }: BulkStageModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("Floración");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const dateCol = stageColumnMap[stage];

    const res = await bulkChangeStage(
      selectedIds,
      stage,
      new Date(date).toISOString(),
      cycleId,
      undefined,
      dateCol
    );

    setLoading(false);

    if (res?.success) {
      router.refresh();
      onSuccess();
      onClose();
      showToast(`Etapa actualizada a ${stage}`);
    } else {
      showToast(res?.error || "No se pudo cambiar la etapa", "error");
    }
  };

  const plantsLabel = `${selectedIds.length} ${selectedIds.length === 1 ? "planta" : "plantas"}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cambio de etapa"
      description={`Se moverá ${plantsLabel}.`}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="bulk-stage-form" className="btn btn-primary" disabled={loading}>
            {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
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
            {Object.keys(stageColumnMap).map((label) => (
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
