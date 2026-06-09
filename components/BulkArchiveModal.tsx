"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkArchivePlants } from "@/app/cycles/actions";
import { useToast } from "@/app/context/ToastContext";

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

  if (!isOpen) return null;

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
      alert("Error: " + res?.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative bg-brand-card w-full max-w-sm rounded-2xl border border-card-border shadow-sm p-6 animate-in zoom-in duration-200">
        <h2 className="text-xl font-title text-brand-primary mb-1 uppercase">Archivar Plantas</h2>
        <p className="text-xs text-brand-muted mb-6">
            Moviendo a archivo <span className="font-bold text-foreground">{selectedIds.length} plantas</span>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-brand-muted mb-1 text-xs font-bold uppercase">Motivo / Notas</label>
            <textarea
              className="w-full bg-slate-50 border border-card-border rounded-lg p-3 text-foreground focus:border-brand-primary outline-none resize-none h-24"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Plantas macho, terminadas..."
            ></textarea>
          </div>

          <div>
            <label className="block text-brand-muted mb-1 text-xs font-bold uppercase">Fecha</label>
            <input
              type="date"
              required
              className="w-full bg-slate-50 border border-card-border rounded-lg p-3 text-foreground focus:border-brand-primary outline-none"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="flex gap-3 mt-6 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-brand-muted hover:text-foreground font-bold text-xs uppercase"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brand-primary hover:bg-brand-primary/80 text-black py-3 rounded-lg font-title tracking-wide transition disabled:opacity-50"
            >
              {loading ? "PROCESANDO..." : "ARCHIVAR"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
