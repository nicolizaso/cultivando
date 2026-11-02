"use client";

import { useState } from "react";
import { ArrowRightCircle } from "lucide-react";

import { bulkChangeStage } from "@/app/actions/plants";
import { STAGE_NAMES } from "@/app/lib/stage-logic";
import { plantCountLabel, todayForInput } from "@/app/lib/utils";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";
import { ChoiceGroup, DateField, FormActions, stageOptions } from "@/components/ui/form";

interface BulkStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: number[];
  onSuccess: () => void;
}

const STAGE_OPTIONS = stageOptions(STAGE_NAMES);

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
      title="Cambiar de etapa"
      description={`${plantCountLabel(selectedIds.length)} pasan a la etapa que elijas.`}
      footer={
        <FormActions
          form="bulk-stage-form"
          onCancel={onClose}
          icon={ArrowRightCircle}
          pending={loading}
          pendingLabel="Cambiando…"
          submitLabel={`Pasar a ${stage}`}
        />
      }
    >
      <form id="bulk-stage-form" onSubmit={handleSubmit} className="space-y-6">
        <ChoiceGroup legend="Nueva etapa" options={STAGE_OPTIONS} value={stage} onChange={setStage} size="sm" />

        <DateField
          label="Desde cuándo"
          value={date}
          onChange={setDate}
          hint="Los días en la etapa se cuentan desde acá."
        />
      </form>
    </Modal>
  );
}
