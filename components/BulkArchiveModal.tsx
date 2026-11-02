"use client";

import { useState } from "react";
import { Archive, ArchiveRestore } from "lucide-react";

import { bulkSetArchived } from "@/app/actions/plants";
import { plantCountLabel, todayForInput } from "@/app/lib/utils";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";
import { DateField, Field, FormActions, Textarea } from "@/components/ui/form";

/** Los motivos de siempre, a un toque. */
const REASONS = ["Cosecha terminada", "Macho", "Murió", "Regalada"];

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
          ? `${plantCountLabel(selectedIds.length)} salen del listado. Siguen en el historial.`
          : `${plantCountLabel(selectedIds.length)} vuelven al listado, con su historial intacto.`
      }
      footer={
        <FormActions
          form="bulk-archive-form"
          onCancel={onClose}
          icon={isArchiving ? Archive : ArchiveRestore}
          pending={loading}
          pendingLabel={isArchiving ? "Archivando…" : "Restaurando…"}
          submitLabel={isArchiving ? "Archivar" : "Restaurar"}
        />
      }
    >
      <form id="bulk-archive-form" onSubmit={handleSubmit} className="space-y-6">
        {isArchiving && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Motivos frecuentes">
            {REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                className="choice choice-sm"
                aria-pressed={notes === reason}
                onClick={() => setNotes(notes === reason ? "" : reason)}
              >
                {reason}
              </button>
            ))}
          </div>
        )}

        <Field label={isArchiving ? "Motivo" : "Nota"} optional hint="Queda anotado en la bitácora de cada planta.">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isArchiving ? "Ej: cosecha terminada" : "Ej: se archivaron por error"}
          />
        </Field>

        <DateField label="Fecha" value={date} onChange={setDate} />
      </form>
    </Modal>
  );
}
