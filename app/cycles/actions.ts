'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { formatDateShort } from '@/app/lib/utils';

export async function bulkArchivePlants(
  plantIds: number[],
  notes: string,
  date: string,
  cycleId?: number
) {
  const supabase = await createClient();

  try {
    const count = plantIds.length;
    const title = `Archivada`;

    const formattedDate = formatDateShort(date);
    const finalNotes = notes ? `${notes}\nFecha: ${formattedDate}` : `Fecha: ${formattedDate}`;

    // 1. Actualizar is_archived = true en plantas
    const { error: updateError } = await supabase
      .from('plants')
      .update({ is_archived: true })
      .in('id', plantIds);

    if (updateError) throw updateError;

    // 2. Insertar log (uno por cada planta)
    const logsToInsert = plantIds.map((plantId) => ({
      cycle_id: cycleId || null,
      plant_id: plantId,
      type: 'Nota',
      title: title,
      description: finalNotes,
      created_at: new Date(date).toISOString(),
    }));

    const { error: logError } = await supabase
      .from('logs')
      .insert(logsToInsert);

    if (logError) throw logError;

    if (cycleId) {
        revalidatePath(`/cycles/${cycleId}`);
    }
    revalidatePath('/plants');

    return { success: true };
  } catch (err: any) {
    console.error("Error in bulkArchivePlants:", err);
    return { error: 'No se pudieron archivar las plantas.' };
  }
}

export async function bulkWaterPlants(
  plantIds: number[], 
  date: string, 
  notes: string,
  cycleId: number
) {
  const supabase = await createClient();

  try {
    // 1. Crear UN registro de Log (Bitácora) para la acción masiva
    const count = plantIds.length;
    const title = `Riego masivo aplicado a ${count} plantas`;

    // Notes can include the date formatted
    const formattedDate = formatDateShort(date);
    const finalNotes = notes ? `${notes}\nFecha: ${formattedDate}` : `Fecha: ${formattedDate}`;

    const { error: logError } = await supabase
      .from('logs')
      .insert({
        cycle_id: cycleId, // Link to cycle
        plant_id: null,    // Not linked to specific plant
        type: 'Riego',
        title: title,
        notes: finalNotes,
        created_at: date
      });

    if (logError) throw logError;

    // 2. Actualizar el campo "last_water" en la tabla de plantas
    // (Para que en la tabla se vea "Hoy")
    const { error: plantError } = await supabase
      .from('plants')
      .update({ last_water: date.split('T')[0] }) // Guardamos solo YYYY-MM-DD
      .in('id', plantIds);

    if (plantError) throw plantError;

    // 3. Recargar la página para ver los cambios
    revalidatePath('/cycles/[id]', 'page');
    
    return { success: true };

  } catch (error) {
    console.error('Error en riego masivo:', error);
    return { error: 'Error al registrar el riego.' };
  }
}


export async function bulkChangeStage(
    plantIds: number[], 
    newStage: string,
    date: string,
    cycleId: number,
    notes?: string,
    stageDateColumn?: string
  ) {
    const supabase = await createClient();
  
    try {
      // 1. Crear UN log para documentar el cambio
      const count = plantIds.length;
      const formattedDate = formatDateShort(date);

      const { error: logError } = await supabase
        .from('logs')
        .insert({
            cycle_id: cycleId,
            plant_id: null,
            type: 'Cambio de Etapa',
            title: `Cambio de etapa a ${newStage} para ${count} plantas`,
            notes: notes || `Cambio de etapa masivo registrado el ${formattedDate}`,
            created_at: date
        });
  
      if (logError) throw logError;
  
      // 2. Actualizar la etapa en las plantas Y stage_updated_at
      const updates: any = {
        stage: newStage,
        stage_updated_at: date // Use the provided date
      };

      if (stageDateColumn) {
        updates[stageDateColumn] = date;
      }

      const { error: plantError } = await supabase
        .from('plants')
        .update(updates)
        .in('id', plantIds);
  
      if (plantError) throw plantError;
  
      revalidatePath('/cycles/[id]', 'page');
      return { success: true };
  
    } catch (error) {
      console.error('Error en cambio de etapa masivo:', error);
      return { error: 'Error al cambiar etapa.' };
    }
  }

  export async function addMeasurement(
    cycleId: number, 
    temperature: number, 
    humidity: number,
    date: string
  ) {
    const supabase = await createClient();
  
    try {
      const { error } = await supabase
        .from('measurements')
        .insert({
          cycle_id: cycleId,
          temperature,
          humidity,
          date
        });
  
      if (error) throw error;
  
      revalidatePath('/cycles/[id]', 'page');
      revalidatePath('/'); // También actualizamos el dashboard principal
      return { success: true };
  
    } catch (error) {
      console.error('Error al guardar medición:', error);
      return { error: 'Error al guardar medición' };
    }
  }

  export async function uploadCycleImage(cycleId: number | string, formData: FormData) {
    const supabase = await createClient();
    const file = formData.get('file') as File;

    if (!file) {
      return { error: 'No file provided' };
    }

    try {
      const numericCycleId = Number(cycleId);
      if (isNaN(numericCycleId)) {
        throw new Error(`Invalid cycle ID: ${cycleId}`);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `cycle_${numericCycleId}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      // Insert into cycle_images
      const { error: dbError } = await supabase
        .from('cycle_images')
        .insert({
          cycle_id: numericCycleId,
          storage_path: filePath,
          public_url: publicUrl,
          taken_at: new Date().toISOString()
        });

      if (dbError) throw dbError;

      revalidatePath('/cycles/[id]', 'page');
      return { success: true };

    } catch (error) {
      console.error('Full Upload Error:', error);
      return { error: (error as Error).message || 'Unknown upload error' };
    }
  }

  export async function deleteCycleImages(imageIds: string[]) {
    const supabase = await createClient();

    try {
      // 1. Get storage paths for the images to delete
      const { data: images, error: fetchError } = await supabase
        .from('cycle_images')
        .select('storage_path')
        .in('id', imageIds);

      if (fetchError) throw fetchError;

      if (images && images.length > 0) {
        const paths = images.map(img => img.storage_path);

        // 2. Delete files from Storage
        const { error: storageError } = await supabase.storage
          .from('images')
          .remove(paths);

        if (storageError) console.error('Error deleting files from storage:', storageError);
      }

      // 3. Delete records from DB
      const { error: dbError } = await supabase
        .from('cycle_images')
        .delete()
        .in('id', imageIds);

      if (dbError) throw dbError;

      revalidatePath('/cycles/[id]', 'page');
      return { success: true };

    } catch (error) {
      console.error('Error deleting cycle images:', error);
      return { error: 'Error al eliminar las imágenes.' };
    }
  }

  export async function updateCycleImage(id: string, updates: { taken_at?: Date | string, description?: string }) {
    const supabase = await createClient();

    try {
      const { error } = await supabase
        .from('cycle_images')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      revalidatePath('/cycles/[id]', 'page');
      return { success: true };

    } catch (error) {
      console.error('Error updating cycle image:', error);
      return { error: 'Error al actualizar la imagen.' };
    }
  }

export async function createCycleWithSpace(name: string, startDate: string, spaceId: number) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No autorizado" };
  }

  try {
    const { data, error } = await supabase
      .from('cycles')
      .insert([
        {
          name: name,
          start_date: startDate,
          space_id: spaceId,
          is_active: true,
          user_id: user.id,
        },
      ])
      .select('id')
      .single();

    if (error) {
      console.error("Error creating cycle:", error);
      return { success: false, error: "Error al crear el ciclo" };
    }

    revalidatePath("/cycles");
    revalidatePath("/");
    return { success: true, cycleId: data.id };
  } catch (error) {
    console.error("Error in createCycleWithSpace:", error);
    return { success: false, error: "Error inesperado" };
  }
}
