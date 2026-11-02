"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/context/ToastContext";
import imageCompression from 'browser-image-compression';
import { Camera, RefreshCw, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { addPlantLog } from "@/app/actions/logs";
import { Field, FormActions, Textarea } from "@/components/ui/form";

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

  // La vista previa es una URL local del archivo; se libera al cambiarlo.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  };

  const clearFile = () => {
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      clearFile();
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
        description={`Una foto, una nota o las dos, para ${plantName}.`}
        footer={
          <FormActions
            form="log-form"
            onCancel={() => setIsOpen(false)}
            pending={loading}
            pendingLabel={file ? "Subiendo…" : "Guardando…"}
            submitLabel={file && note.trim() ? "Guardar foto y nota" : file ? "Guardar foto" : "Guardar nota"}
            disabled={!file && !note.trim()}
          />
        }
      >
        <form id="log-form" onSubmit={handleSubmit} className="space-y-6">
          <input
            id="log-file"
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="peer sr-only"
            aria-label="Elegir foto"
          />

          {file && previewUrl ? (
            <figure className="relative overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--ring)]">
              {/* Vista previa local: todavía no se subió nada */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Vista previa de la foto elegida" className="max-h-72 w-full object-cover" />
              <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-fg-muted">
                <span className="truncate">{file.name}</span>
                <span className="flex shrink-0 gap-1">
                  <label htmlFor="log-file" className="btn btn-sm btn-ghost cursor-pointer">
                    <RefreshCw size={14} aria-hidden="true" />
                    Cambiar
                  </label>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={clearFile}>
                    <X size={14} aria-hidden="true" />
                    Quitar
                  </button>
                </span>
              </figcaption>
            </figure>
          ) : (
            /* El input real conserva el foco y el teclado; el bloque es sólo la piel visual. */
            <label
              htmlFor="log-file"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed border-line-strong px-6 py-8 text-center transition-colors hover:border-[color:var(--brand)] hover:bg-brand-soft peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--ring)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-[color:var(--brand-text)]" aria-hidden="true">
                <Camera size={22} />
              </span>
              <span className="text-sm font-semibold text-fg">Sacar o elegir una foto</span>
              <span className="text-xs text-fg-muted">Se achica antes de subirla</span>
            </label>
          )}

          <Field label="Nota" optional>
            <Textarea
              placeholder="¿Cómo la ves hoy? Hojas amarillas, creció mucho…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </form>
      </Modal>
    </>
  );
}
