"use client";

import { useState } from "react";
import { bulkWaterPlants } from "@/app/cycles/actions";
import { Droplets, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";

interface BulkWaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: number[];
  onSuccess: () => void; // Para limpiar la selección después
  cycleId: number;
}

export default function BulkWaterModal({ isOpen, onClose, selectedIds, onSuccess, cycleId }: BulkWaterModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState("");
  const [nutrients, setNutrients] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Construimos una nota automática con los detalles
    const noteDetails = `Riego registrado para ${selectedIds.length} plantas.\nCantidad: ${amount || 'No especificada'}\nNutrientes: ${nutrients || 'Solo agua'}`;

    const res = await bulkWaterPlants(selectedIds, new Date(date).toISOString(), noteDetails, cycleId);

    setLoading(false);

    if (res?.success) {
      onSuccess();
      onClose();
      setAmount("");
      setNutrients("");
      showToast(`Riego registrado en ${selectedIds.length} plantas`);
    } else {
      showToast("No se pudo registrar el riego", "error");
    }
  };

  const plantsLabel = `${selectedIds.length} ${selectedIds.length === 1 ? "planta" : "plantas"}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Riego masivo"
      description={`Se aplicará a ${plantsLabel} seleccionadas.`}
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
        </div>

        <div className="field">
          <label htmlFor="bulk-water-amount" className="field-label">Cantidad</label>
          <input
            id="bulk-water-amount"
            type="text"
            placeholder="Ej: 50 litros totales"
            className="field-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <p className="field-hint">Opcional. Podés anotar litros o mililitros.</p>
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
