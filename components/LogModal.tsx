"use client";

import { useState, useRef } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/context/ToastContext";
import imageCompression from 'browser-image-compression';
import { Camera, Check, ImagePlus, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";

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
    setLoading(true);

    try {
        let publicUrl = null;

        if (file) {
          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          };

          try {
            const compressedFile = await imageCompression(file, options);

            const fileExt = file.name.split('.').pop();
            const fileName = `plant_${plantId}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('images')
              .upload(filePath, compressedFile);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
              .from('images')
              .getPublicUrl(filePath);

            publicUrl = data.publicUrl;

          } catch (error) {
            console.error("Error en compresión/subida:", error);
            showToast("No se pudo procesar la imagen", "error");
            setLoading(false);
            return;
          }
        }

      const { error: dbError } = await supabase
        .from('logs')
        .insert([
          {
            plant_id: plantId,
            title: file ? "Nueva foto" : "Nota de bitácora",
            notes: note,
            type: file ? 'Foto' : 'Nota',
            media_url: publicUrl ? [publicUrl] : [],
          }
        ]);

      if (dbError) throw dbError;

      // Si subimos una foto, pasa a ser la portada de la planta.
      if (publicUrl) {
        await supabase
          .from('plants')
          .update({ image_url: publicUrl })
          .eq('id', plantId);
      }

      setIsOpen(false);
      setNote("");
      setFile(null);
      showToast(publicUrl ? 'Foto agregada a la bitácora' : 'Nota agregada a la bitácora', 'success');
      router.refresh();

    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo guardar el registro", "error");
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
