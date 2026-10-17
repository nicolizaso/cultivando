'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/app/lib/auth';
import { friendlyDbError } from '@/app/lib/errors';
import { parseId } from '@/app/lib/sanitize';
import { parseCultivationDate } from '@/app/lib/dates';
import { IMAGES_BUCKET, buildImagePath, validateImage } from '@/app/lib/uploads';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function revalidateCycleViews() {
  revalidatePath('/cycles/[id]', 'page');
  revalidatePath('/cycles');
  revalidatePath('/');
}

/**
 * Registra una lectura de clima del ciclo. Los rangos son los de un sensor
 * doméstico: fuera de eso es casi seguro un error de tipeo.
 */
export async function addMeasurement(
  cycleId: number,
  temperature: number,
  humidity: number,
  date: string
) {
  const session = await requireUser();
  if ('error' in session) return { error: session.error };
  const { supabase } = session;

  const id = parseId(cycleId);
  const temp = Number(temperature);
  const hum = Number(humidity);

  if (!id) return { error: 'Ese ciclo no es válido.' };
  if (!Number.isFinite(temp) || temp < -20 || temp > 60) return { error: 'La temperatura tiene que estar entre -20 y 60 °C.' };
  if (!Number.isFinite(hum) || hum < 0 || hum > 100) return { error: 'La humedad tiene que estar entre 0 y 100 %.' };
  if (typeof date !== 'string' || !DATE_ONLY.test(date)) return { error: 'La fecha no es válida.' };

  const { error } = await supabase.from('measurements').insert({
    cycle_id: id,
    temperature: temp,
    humidity: hum,
    date,
  });

  if (error) return { error: friendlyDbError(error, 'No se pudo guardar la medición.', {}, 'Error al guardar medición:') };

  revalidateCycleViews();
  return { success: true };
}

/**
 * Sube una foto a la galería del ciclo. El archivo va en la carpeta del
 * usuario; si después no se puede registrar la fila, el archivo se borra para
 * no dejar huérfanos en el bucket.
 */
export async function uploadCycleImage(cycleId: number | string, formData: FormData) {
  const session = await requireUser();
  if ('error' in session) return { error: session.error };
  const { supabase, user } = session;

  const id = parseId(cycleId);
  if (!id) return { error: 'Ese ciclo no es válido.' };

  const file = formData.get('file');
  if (!(file instanceof File)) return { error: 'No llegó ninguna foto.' };
  const invalid = validateImage(file);
  if (invalid) return { error: invalid };

  // La RLS no devuelve ciclos ajenos: si no vuelve, no es del usuario.
  const { data: cycle } = await supabase.from('cycles').select('id').eq('id', id).maybeSingle();
  if (!cycle) return { error: 'No se encontró el ciclo.' };

  const filePath = buildImagePath(user.id, 'cycles', id, file.type);

  const { error: uploadError } = await supabase.storage
    .from(IMAGES_BUCKET)
    .upload(filePath, file, { contentType: file.type });

  if (uploadError) {
    console.error('Error subiendo la foto del ciclo:', uploadError);
    return { error: 'No se pudo subir la foto.' };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(filePath);

  const { error: dbError } = await supabase.from('cycle_images').insert({
    cycle_id: id,
    storage_path: filePath,
    public_url: publicUrl,
    taken_at: new Date().toISOString(),
  });

  if (dbError) {
    await supabase.storage.from(IMAGES_BUCKET).remove([filePath]);
    return { error: friendlyDbError(dbError, 'No se pudo guardar la foto.', {}, 'Error registrando la foto del ciclo:') };
  }

  revalidatePath('/cycles/[id]', 'page');
  revalidatePath('/cycles');
  return { success: true };
}

/**
 * Borra fotos de la galería: primero los archivos y después las filas. Si un
 * archivo no se puede borrar, la fila se borra igual (la foto deja de verse)
 * y el archivo queda anotado en el log para limpiarlo.
 */
export async function deleteCycleImages(imageIds: string[]) {
  const session = await requireUser();
  if ('error' in session) return { error: session.error };
  const { supabase } = session;

  const ids = Array.isArray(imageIds) ? imageIds.filter((id) => typeof id === 'string' && UUID_PATTERN.test(id)) : [];
  if (ids.length === 0) return { error: 'No hay fotos seleccionadas.' };

  const { data: images, error: fetchError } = await supabase
    .from('cycle_images')
    .select('id, storage_path')
    .in('id', ids);

  if (fetchError) return { error: friendlyDbError(fetchError, 'No se pudieron leer las fotos.', {}, 'Error leyendo fotos del ciclo:') };
  if (!images || images.length === 0) return { error: 'No se encontraron las fotos.' };

  const paths = images.map((image) => image.storage_path).filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from(IMAGES_BUCKET).remove(paths);
    if (storageError) console.error('No se pudieron borrar los archivos de las fotos:', paths, storageError);
  }

  const { error: dbError } = await supabase
    .from('cycle_images')
    .delete()
    .in('id', images.map((image) => image.id));

  if (dbError) return { error: friendlyDbError(dbError, 'No se pudieron eliminar las fotos.', {}, 'Error eliminando fotos del ciclo:') };

  revalidatePath('/cycles/[id]', 'page');
  revalidatePath('/cycles');
  return { success: true };
}

/** Corrige la fecha o la descripción de una foto; nada más se puede tocar. */
export async function updateCycleImage(id: string, updates: { taken_at?: Date | string; description?: string }) {
  const session = await requireUser();
  if ('error' in session) return { error: session.error };
  const { supabase } = session;

  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return { error: 'Esa foto no es válida.' };

  const changes: { taken_at?: string; description?: string | null } = {};

  if (updates?.taken_at !== undefined) {
    const raw = updates.taken_at instanceof Date ? updates.taken_at.toISOString() : String(updates.taken_at);
    const parsed = parseCultivationDate(raw);
    if (!parsed) return { error: 'La fecha no es válida.' };
    changes.taken_at = parsed.toISOString();
  }

  if (updates?.description !== undefined) {
    changes.description = typeof updates.description === 'string' ? updates.description.trim().slice(0, 500) || null : null;
  }

  if (Object.keys(changes).length === 0) return { success: true };

  const { error } = await supabase.from('cycle_images').update(changes).eq('id', id);
  if (error) return { error: friendlyDbError(error, 'No se pudo actualizar la foto.', {}, 'Error actualizando la foto:') };

  revalidatePath('/cycles/[id]', 'page');
  return { success: true };
}

export async function createCycleWithSpace(name: string, startDate: string, spaceId: number) {
  const session = await requireUser();
  if ('error' in session) return { success: false, error: session.error };
  const { supabase, user } = session;

  const cleanName = typeof name === 'string' ? name.trim().slice(0, 80) : '';
  const space = parseId(spaceId);

  if (!cleanName) return { success: false, error: 'El ciclo necesita un nombre.' };
  if (typeof startDate !== 'string' || !DATE_ONLY.test(startDate)) return { success: false, error: 'La fecha de inicio no es válida.' };
  if (!space) return { success: false, error: 'Elegí un espacio para el ciclo.' };

  const { data, error } = await supabase
    .from('cycles')
    .insert({
      name: cleanName,
      start_date: startDate,
      space_id: space,
      is_active: true,
      user_id: user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { success: false, error: friendlyDbError(error, 'No se pudo crear el ciclo.', {}, 'Error creando el ciclo:') };
  }

  revalidatePath('/cycles');
  revalidatePath('/');
  return { success: true, cycleId: data.id };
}

/**
 * Muda un ciclo de un espacio a otro. Las plantas no guardan espacio: viven en
 * su ciclo, así que se mudan con él sin tocarlas.
 */
export async function moveCycleToSpace(cycleId: number, spaceId: number) {
  const session = await requireUser();
  if ('error' in session) return { success: false, error: session.error };
  const { supabase, user } = session;

  const id = parseId(cycleId);
  const targetSpaceId = parseId(spaceId);
  if (!id || !targetSpaceId) return { success: false, error: 'Datos inválidos.' };

  const { data: cycle, error: cycleError } = await supabase
    .from('cycles')
    .select('id, name, space_id, spaces ( name )')
    .eq('id', id)
    .single();

  if (cycleError || !cycle) {
    return { success: false, error: 'No se encontró el ciclo' };
  }

  if (cycle.space_id === targetSpaceId) {
    return { success: false, error: 'El ciclo ya está en ese espacio' };
  }

  const { data: space, error: spaceError } = await supabase
    .from('spaces')
    .select('id, name')
    .eq('id', targetSpaceId)
    .single();

  if (spaceError || !space) {
    return { success: false, error: 'No se encontró el espacio de destino' };
  }

  const { error: updateError } = await supabase
    .from('cycles')
    .update({ space_id: targetSpaceId })
    .eq('id', id);

  if (updateError) {
    return { success: false, error: friendlyDbError(updateError, 'No se pudo mover el ciclo de espacio', {}, 'Error al mudar el ciclo de espacio:') };
  }

  // La mudanza queda en la bitácora: es un cambio de condiciones que explica
  // saltos de temperatura o humedad más adelante.
  const previousSpace = cycle.spaces as { name: string } | { name: string }[] | null;
  const fromName = (Array.isArray(previousSpace) ? previousSpace[0]?.name : previousSpace?.name) || 'Sin espacio';

  const { error: logError } = await supabase.from('logs').insert({
    cycle_id: id,
    plant_id: null,
    user_id: user.id,
    type: 'ambiente',
    title: `Mudanza de espacio: ${fromName} → ${space.name}`,
    notes: `El ciclo pasó de "${fromName}" a "${space.name}".`,
    created_at: new Date().toISOString(),
  });

  // El registro es historial, no parte de la mudanza: si falla, el ciclo ya
  // se mudó y avisar de un error sería mentirle al usuario.
  if (logError) console.error('Error al registrar la mudanza en la bitácora:', logError);

  revalidatePath('/cycles/[id]', 'page');
  revalidatePath('/cycles');
  revalidatePath('/spaces');
  revalidatePath('/plants');
  revalidatePath('/plants/[id]', 'page');
  revalidatePath('/');

  return { success: true, spaceName: space.name };
}
