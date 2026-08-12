"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkArchivePlants } from "@/app/cycles/actions";
import { useToast } from "@/app/context/ToastContext";
import { Archive, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";

interface BulkArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: number[];
  onSuccess: () => void;
  cycleId?: number;
}

export default function BulkArchiveModal({ isOpen, onClose, selectedIds, onSuccess, cycleId }: BulkArchiveModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await bulkArchivePlants(
      selectedIds,
      notes,
      new Date(date).toISOString(),
      cycleId
    );

    setLoading(false);

    if (res?.success) {
      showToast(`${selectedIds.length} plantas archivadas`, 'success');
      router.refresh();
      onSuccess();
      onClose();
    } else {
      showToast(res?.error || "No se pudieron archivar las plantas", "error");
    }
  };

  const plantsLabel = `${selectedIds.length} ${selectedIds.length === 1 ? "planta" : "plantas"}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Archivar plantas"
      description={`Se archivará ${plantsLabel}. Podés consultarlas después en el historial.`}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="bulk-archive-form" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Archive size={16} aria-hidden="true" />
            )}
            {loading ? "Procesando..." : "Archivar"}
          </button>
        </>
      }
    >
      <form id="bulk-archive-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="field">
          <label htmlFor="bulk-archive-notes" className="field-label">Motivo o notas</label>
          <textarea
            id="bulk-archive-notes"
            data-autofocus
            rows={3}
            className="field-input resize-none"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: plantas macho, cosecha terminada"
          />
        </div>

        <div className="field">
          <label htmlFor="bulk-archive-date" className="field-label">Fecha</label>
          <input
            id="bulk-archive-date"
            type="date"
            required
            className="field-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
