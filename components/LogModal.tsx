"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/context/ToastContext";
import imageCompression from 'browser-image-compression';
import { Camera, Check, ImagePlus, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { addPlantLog } from "@/app/actions/logs";

interface Props {
  plantId: number;
  plantName: string;
}

export default function LogModal({ plantId, plantName }: Props) {
  const { showToast } = useToast();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !note.trim()) {
      showToast("Escribí una nota o elegí una foto", "error");
      return;
    }
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("note", note);

      if (file) {
        // Se comprime acá para que viaje liviana; el servidor vuelve a validar
        // el tipo y el tamaño antes de subirla.
        try {
          const compressed = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          });
          formData.append("file", compressed, file.name);
        } catch (error) {
          console.error("Error comprimiendo la foto:", error);
          showToast("No se pudo procesar la imagen", "error");
          return;
        }
      }

      const result = await addPlantLog(plantId, formData);
      if (result?.error) {
        showToast(result.error, "error");
        return;
      }

      setIsOpen(false);
      setNote("");
      setFile(null);
      showToast(result?.photo ? 'Foto agregada a la bitácora' : 'Nota agregada a la bitácora', 'success');
      router.refresh();
    } catch (error) {
      console.error(error);
      showToast("No se pudo guardar el registro", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn-icon text-[color:var(--brand-text)]"
        aria-label={`Agregar foto o nota a ${plantName}`}
      >
        <Camera className="h-5 w-5" aria-hidden="true" />
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Bitácora"
        description={`Nuevo registro para ${plantName}.`}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setIsOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="log-form" className="btn btn-primary" disabled={loading}>
              {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {loading ? "Subiendo..." : "Guardar"}
            </button>
          </>
        }
      >
        <form id="log-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="field">
            <span className="field-label">Foto</span>
            {/* El input real conserva el foco y el teclado; el bloque es sólo la piel visual. */}
            <label
              htmlFor="log-file"
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed p-6 text-center transition-colors ${
                file
                  ? "border-[color:var(--brand)] bg-brand-soft"
                  : "border-line-strong hover:border-[color:var(--brand)] hover:bg-surface-2"
              }`}
            >
              <input
                id="log-file"
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="sr-only"
              />

              {file ? (
                <>
                  <Check className="h-6 w-6 text-[color:var(--brand-text)]" aria-hidden="true" />
                  <span className="break-all text-xs font-semibold text-[color:var(--brand-text)]">{file.name}</span>
                  <span className="text-xs text-fg-muted">Tocá para cambiarla</span>
                </>
              ) : (
                <>
                  <ImagePlus className="h-6 w-6 text-fg-muted" aria-hidden="true" />
                  <span className="text-sm font-semibold text-fg">Subir foto</span>
                  <span className="text-xs text-fg-muted">Se comprime antes de subirla</span>
                </>
              )}
            </label>
          </div>

          <div className="field">
            <label htmlFor="log-note" className="field-label">Nota (opcional)</label>
            <textarea
              id="log-note"
              rows={3}
              className="field-input resize-none"
              placeholder="¿Cómo la ves hoy? Hojas amarillas, creció mucho..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
