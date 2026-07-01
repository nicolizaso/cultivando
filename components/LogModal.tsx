"use client";

import { useState, useRef } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/context/ToastContext";
import imageCompression from 'browser-image-compression';
import { Camera } from "lucide-react";

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
  
  // Referencia oculta para el input de archivo (para abrirlo con un botón bonito)
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
          // 1. CONFIGURACIÓN DE COMPRESIÓN
          const options = {
            maxSizeMB: 1,          // Máximo 1MB
            maxWidthOrHeight: 1920, // Reducir dimensiones si es gigante (4K)
            useWebWorker: true,    // Usar hilo secundario para no congelar la app
          };
  
          try {
            // 2. COMPRIMIR
            // "compressedFile" será mucho más ligero
            const compressedFile = await imageCompression(file, options);

            // 3. PREPARAR NOMBRE Y RUTA
            const fileExt = file.name.split('.').pop();
            const fileName = `plant_${plantId}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;
  
            // 4. SUBIR EL ARCHIVO YA COMPRIMIDO
            const { error: uploadError } = await supabase.storage
              .from('images')
              .upload(filePath, compressedFile); // <--- OJO: Subimos compressedFile
  
            if (uploadError) throw uploadError;
  
            const { data } = supabase.storage
              .from('images')
              .getPublicUrl(filePath);
              
            publicUrl = data.publicUrl;
  
          } catch (error) {
            console.error("Error en compresión/subida:", error);
            alert("Error al procesar la imagen");
            setLoading(false);
            return;
          }
        }

      // 2. GUARDAMOS EL REGISTRO EN LA TABLA LOGS
      // Usamos los ENUMS que definimos en SQL (type: 'Foto' o 'Nota')
      const { error: dbError } = await supabase
        .from('logs')
        .insert([
          {
            plant_id: plantId,
            title: file ? "Nueva Foto 📷" : "Nota de Bitácora 📝",
            notes: note,
            type: file ? 'Foto' : 'Nota', 
            media_url: publicUrl ? [publicUrl] : [], // Guardamos como array
          }
        ]);

      if (dbError) throw dbError;

      // --- NUEVO: 3. ACTUALIZAR FOTO DE PORTADA ---
      // Si subimos una foto, actualizamos la planta para que esta sea su nueva cara
      if (publicUrl) {
        await supabase
          .from('plants')
          .update({ image_url: publicUrl }) // Guardamos la URL en la planta
          .eq('id', plantId);
      }

      // 3. LIMPIEZA Y CIERRE
      setIsOpen(false);
      setNote("");
      setFile(null);
      showToast('Imagen Actualizada', 'success');
      router.refresh();

    } catch (error) {
      console.error(error);
      alert("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* BOTÓN DISPARADOR (Cámara Pequeña) */}
      <button 
        onClick={() => setIsOpen(true)}
        className="text-brand-muted hover:text-brand-primary transition-colors p-2 rounded-full hover:bg-brand-card border border-transparent hover:border-brand-primary/30"
        title="Agregar Foto/Nota"
      >
        <Camera className="w-6 h-6 text-brand-primary" />
      </button>

      {/* MODAL */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          ></div>

          <div className="relative bg-brand-card w-full max-w-sm rounded-2xl border border-card-border shadow-sm p-6 animate-in zoom-in duration-200">
            
            <h3 className="text-xl font-title text-foreground mb-1">Bitácora</h3>
            <p className="text-xs text-brand-muted mb-4">Para: <span className="text-brand-primary">{plantName}</span></p>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* INPUT DE FOTO (Oculto + Botón Visual) */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  file ? 'border-brand-primary bg-brand-primary/10' : 'border-[#444] hover:border-brand-muted hover:bg-slate-200'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                
                {file ? (
                  <>
                    <span className="text-2xl mb-2">✅</span>
                    <p className="text-xs text-brand-primary font-bold text-center break-all">{file.name}</p>
                    <p className="text-[10px] text-brand-muted mt-1">(Toca para cambiar)</p>
                  </>
                ) : (
                  <>
                    <span className="text-2xl mb-2 text-brand-muted">📸</span>
                    <p className="text-xs text-brand-muted font-bold">Subir Foto</p>
                  </>
                )}
              </div>

              {/* NOTA DE TEXTO */}
              <div>
                <label className="block text-brand-muted mb-1 text-xs font-bold uppercase">Nota (Opcional)</label>
                <textarea 
                  rows={3}
                  className="w-full bg-slate-50 border border-card-border rounded-lg p-3 text-foreground focus:border-brand-primary outline-none text-sm resize-none"
                  placeholder="¿Cómo la ves hoy? Hojas amarillas, creció mucho..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {/* BOTONES */}
              <div className="flex gap-3 mt-2">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-3 text-brand-muted hover:text-foreground font-bold text-xs uppercase"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-brand-bg py-3 rounded-lg font-title tracking-wide transition disabled:opacity-50"
                >
                  {loading ? "SUBIENDO..." : "GUARDAR"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}