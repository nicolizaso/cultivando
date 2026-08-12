"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addMeasurement } from "@/app/cycles/actions";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";

interface MeasurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycleId: number;
}

export default function MeasurementModal({ isOpen, onClose, cycleId }: MeasurementModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [temp, setTemp] = useState("");
  const [hum, setHum] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await addMeasurement(
        cycleId,
        parseFloat(temp),
        parseFloat(hum),
        date
    );

    setLoading(false);

    if (res?.success) {
      router.refresh();
      onClose();
      setTemp("");
      setHum("");
      showToast("Medición guardada");
    } else {
      showToast(res?.error || "No se pudo guardar la medición", "error");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar clima"
      description="Temperatura y humedad del espacio en el momento de la lectura."
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="measurement-form" className="btn btn-primary" disabled={loading}>
            {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </>
      }
    >
      <form id="measurement-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="field">
          <label htmlFor="measurement-date" className="field-label">Fecha</label>
          <input
            id="measurement-date"
            data-autofocus
            type="date"
            required
            className="field-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="field">
            <label htmlFor="measurement-temp" className="field-label">Temp. (°C)</label>
            <input
              id="measurement-temp"
              type="number"
              inputMode="decimal"
              step="0.1"
              required
              placeholder="24.5"
              className="field-input text-lg font-semibold"
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="measurement-hum" className="field-label">Humedad (%)</label>
            <input
              id="measurement-hum"
              type="number"
              inputMode="decimal"
              step="0.1"
              required
              placeholder="60"
              className="field-input text-lg font-semibold"
              value={hum}
              onChange={(e) => setHum(e.target.value)}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
