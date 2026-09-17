"use client";

import { useState } from "react";
import { Droplets, Loader2 } from "lucide-react";

import { bulkWaterPlants } from "@/app/actions/plants";
import { plantCountLabel, todayForInput } from "@/app/lib/utils";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";

interface BulkWaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: number[];
  /** Para limpiar la selección después. */
  onSuccess: () => void;
}

export default function BulkWaterModal({ isOpen, onClose, selectedIds, onSuccess }: BulkWaterModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(todayForInput);
  const [amount, setAmount] = useState("");
  const [nutrients, setNutrients] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await bulkWaterPlants(selectedIds, date, { amount, nutrients });

    setLoading(false);

    if (res.success) {
      showToast(`Riego registrado en ${plantCountLabel(res.count ?? selectedIds.length)}`);
      setAmount("");
      setNutrients("");
      onSuccess();
      onClose();
    } else {
      showToast(res.error || "No se pudo registrar el riego", "error");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar riego"
      description={`Se aplicará a ${plantCountLabel(selectedIds.length)}.`}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="bulk-water-form" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Droplets size={16} aria-hidden="true" />
            )}
            {loading ? "Registrando..." : "Registrar riego"}
          </button>
        </>
      }
    >
      <form id="bulk-water-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="field">
          <label htmlFor="bulk-water-date" className="field-label">Fecha</label>
          <input
            id="bulk-water-date"
            data-autofocus
            type="date"
            required
            className="field-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <p className="field-hint">Es la que se muestra como último riego de cada planta.</p>
        </div>

        <div className="field">
          <label htmlFor="bulk-water-amount" className="field-label">Cantidad</label>
          <input
            id="bulk-water-amount"
            type="text"
            placeholder="Ej: 2 litros por planta"
            className="field-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <p className="field-hint">Opcional. Queda anotado en la bitácora.</p>
        </div>

        <div className="field">
          <label htmlFor="bulk-water-nutrients" className="field-label">Nutrientes y notas</label>
          <textarea
            id="bulk-water-nutrients"
            rows={3}
            placeholder="Ej: Base A+B (2ml/L), CalMag"
            className="field-input resize-none"
            value={nutrients}
            onChange={(e) => setNutrients(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
