'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/app/lib/auth';
import { friendlyDbError } from '@/app/lib/errors';
import { LOG_TYPE } from '@/app/lib/logs';
import { parseId } from '@/app/lib/sanitize';
import { IMAGES_BUCKET, buildImagePath, validateImage } from '@/app/lib/uploads';

const MAX_NOTE_LENGTH = 2000;

/**
 * Agrega una nota o una foto a la bitácora de una planta.
 *
 * La foto viaja ya comprimida desde el navegador y se valida acá (tipo y
 * tamaño) antes de subirla a la carpeta del usuario. Si la foto sube pero el
 * registro no se puede guardar, el archivo se borra.
 */
export async function addPlantLog(plantId: number, formData: FormData) {
  const session = await requireUser();
  if ('error' in session) return { error: session.error };
  const { supabase, user } = session;

  const id = parseId(plantId);
  if (!id) return { error: 'Esa planta no es válida.' };

  const rawNote = formData.get('note');
  const note = typeof rawNote === 'string' ? rawNote.trim().slice(0, MAX_NOTE_LENGTH) : '';

  const rawFile = formData.get('file');
  const file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;

  if (!file && !note) return { error: 'Escribí una nota o elegí una foto.' };

  if (file) {
    const invalid = validateImage(file);
    if (invalid) return { error: invalid };
  }

  const { data: plant } = await supabase.from('plants').select('id, cycle_id').eq('id', id).maybeSingle();
  if (!plant) return { error: 'No se encontró la planta.' };

  let publicUrl: string | null = null;
  let filePath: string | null = null;

  if (file) {
    filePath = buildImagePath(user.id, 'plants', id, file.type);
    const { error: uploadError } = await supabase.storage
      .from(IMAGES_BUCKET)
      .upload(filePath, file, { contentType: file.type });

    if (uploadError) {
      console.error('Error subiendo la foto de la bitácora:', uploadError);
      return { error: 'No se pudo subir la foto.' };
    }

    publicUrl = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(filePath).data.publicUrl;
  }

  const { error: logError } = await supabase.from('logs').insert({
    plant_id: id,
    // Cuelga también del ciclo: así la foto aparece en la galería del ciclo.
    cycle_id: plant.cycle_id,
    user_id: user.id,
    title: file ? 'Nueva foto' : 'Nota de bitácora',
    notes: note || null,
    type: file ? LOG_TYPE.photo : LOG_TYPE.note,
    media_url: publicUrl ? [publicUrl] : [],
  });

  if (logError) {
    if (filePath) await supabase.storage.from(IMAGES_BUCKET).remove([filePath]);
    return { error: friendlyDbError(logError, 'No se pudo guardar el registro.', {}, 'Error guardando la bitácora:') };
  }

  // Una foto nueva pasa a ser la portada de la planta.
  if (publicUrl) {
    const { error: coverError } = await supabase.from('plants').update({ image_url: publicUrl }).eq('id', id);
    if (coverError) console.error('No se pudo actualizar la portada de la planta:', coverError);
  }

  revalidatePath('/plants/[id]', 'page');
  revalidatePath('/plants');
  revalidatePath('/calendar');
  revalidatePath('/cycles/[id]', 'page');
  return { success: true, photo: Boolean(publicUrl) };
}
