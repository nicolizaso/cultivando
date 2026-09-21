"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";

import { bulkSetArchived } from "@/app/actions/plants";
import { plantCountLabel, todayForInput } from "@/app/lib/utils";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";

interface BulkArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: number[];
  onSuccess: () => void;
  /** "restore" devuelve al listado activo lo que estaba archivado. */
  mode?: 'archive' | 'restore';
}

export default function BulkArchiveModal({
  isOpen,
  onClose,
  selectedIds,
  onSuccess,
  mode = 'archive',
}: BulkArchiveModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayForInput);

  const isArchiving = mode === 'archive';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await bulkSetArchived(selectedIds, isArchiving, date, notes);

    setLoading(false);

    if (res.success) {
      const count = plantCountLabel(res.count ?? selectedIds.length);
      showToast(isArchiving ? `${count} archivadas` : `${count} devueltas al listado`);
      setNotes("");
      onSuccess();
      onClose();
    } else {
      showToast(res.error || "No se pudo completar la acción", "error");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isArchiving ? "Archivar plantas" : "Restaurar plantas"}
      description={
        isArchiving
          ? `Se archivará ${plantCountLabel(selectedIds.length)}. Podés consultarlas después en el historial.`
          : `${plantCountLabel(selectedIds.length)} vuelven al listado de activas, con su historial intacto.`
      }
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="bulk-archive-form" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : isArchiving ? (
              <Archive size={16} aria-hidden="true" />
            ) : (
              <ArchiveRestore size={16} aria-hidden="true" />
            )}
            {loading ? "Procesando..." : isArchiving ? "Archivar" : "Restaurar"}
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
            placeholder={isArchiving ? "Ej: plantas macho, cosecha terminada" : "Ej: se archivaron por error"}
          />
          <p className="field-hint">Opcional. Queda en la bitácora de cada planta.</p>
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
