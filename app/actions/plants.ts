"use server";

import { createClient } from "@/app/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { getStageDateColumn } from "@/app/lib/stage-logic";
import { parseCultivationDate } from "@/app/lib/dates";
import { plantCountLabel } from "@/app/lib/utils";

export async function createPlantsBulk(
  count: number,
  strain: string,
  sourceType: 'Semilla' | 'Esqueje',
  cycleId: number
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No autorizado" };
  }

  try {
    const plantsData = Array.from({ length: count }).map((_, index) => ({
      name: `${strain} #${index + 1}`,
      strain: strain,
      source_type: sourceType,
      cycle_id: cycleId,
      user_id: user.id,
      stage: 'Germinación', // Default starting stage
      planted_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from("plants")
      .insert(plantsData)
      .select('id');

    if (error) {
      console.error("Error creating plants bulk:", error);
      return { success: false, error: "Error al crear las plantas" };
    }

    revalidatePath("/plants");
    revalidatePath(`/cycles/${cycleId}`);
    return { success: true, plantIds: data.map(p => p.id) };
  } catch (error) {
    console.error("Error in createPlantsBulk:", error);
    return { success: false, error: "Error inesperado" };
  }
}

/* --------------------------------------------------------------------------
 * Acciones en lote
 *
 * La pantalla de Plantas es un inventario: lo que se selecciona ahí puede
 * venir de varios ciclos a la vez, o de ninguno. Por eso estas acciones no
 * reciben un ciclo, lo deducen de cada planta. Las versiones anteriores vivían
 * en `app/cycles/actions.ts` y exigían un `cycleId`, así que sólo servían
 * dentro de la ficha de un ciclo.
 * ----------------------------------------------------------------------- */

type BulkResult = { success: boolean; count?: number; error?: string };

/** Una planta tal como la necesitan estas acciones: quién es y de qué ciclo. */
interface SelectedPlant {
  id: number;
  name: string;
  cycle_id: number | null;
}

/**
 * Limpia la lista de ids que llega del cliente: sólo enteros positivos, sin
 * repetidos. Lo que no sea un id se descarta en vez de viajar a la consulta.
 */
function parseIds(plantIds: unknown): number[] {
  if (!Array.isArray(plantIds)) return [];

  const ids = plantIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  return Array.from(new Set(ids));
}

/** Texto de formulario ya recortado, o cadena vacía si no vino texto. */
function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Convierte la fecha del formulario en un instante, o null si no se entiende.
 *
 * El anclaje al mediodía que evita que la fecha se corra de día lo hace
 * `parseCultivationDate`; acá sólo se valida que haya llegado una cadena.
 */
function toTimestamp(date: unknown): string | null {
  if (typeof date !== 'string' || !date.trim()) return null;

  return parseCultivationDate(date)?.toISOString() ?? null;
}

/** El día calendario de una fecha de formulario, que es como se guarda `last_water`. */
function toDateOnly(date: string): string {
  return parseCultivationDate(date)?.toLocaleDateString('en-CA') ?? date;
}

/**
 * Todas las páginas que muestran plantas. Una selección puede tocar varios
 * ciclos, así que se revalidan las rutas dinámicas enteras en vez de ir una
 * por una.
 */
function revalidatePlantViews() {
  revalidatePath('/');
  revalidatePath('/plants');
  revalidatePath('/plants/[id]', 'page');
  revalidatePath('/cycles');
  revalidatePath('/cycles/[id]', 'page');
  revalidatePath('/calendar');
}

/**
 * Abre la acción: exige sesión y devuelve las plantas seleccionadas que el
 * usuario realmente puede tocar. La RLS ya filtra por dueño, así que lo que no
 * vuelve de esta consulta tampoco se va a poder modificar después.
 */
async function loadSelection(plantIds: unknown) {
  const ids = parseIds(plantIds);
  if (ids.length === 0) {
    return { error: 'No hay plantas seleccionadas.' as const };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'No autorizado' as const };
  }

  const { data, error } = await supabase
    .from('plants')
    .select('id, name, cycle_id')
    .in('id', ids);

  if (error) {
    console.error('Error leyendo la selección de plantas:', error);
    return { error: 'No se pudieron leer las plantas.' as const };
  }

  if (!data || data.length === 0) {
    return { error: 'No se encontraron las plantas seleccionadas.' as const };
  }

  return { supabase, userId: user.id, plants: data as SelectedPlant[] };
}

/**
 * Anota el movimiento en la bitácora de cada planta.
 *
 * Antes se escribía un único registro por ciclo, con `plant_id` en null, y la
 * ficha de la planta lo pescaba por el ciclo. Con una selección repartida
 * entre ciclos —o sin ciclo— eso deja plantas sin rastro, así que ahora va una
 * entrada por planta, colgada también de su ciclo cuando lo tiene.
 *
 * Si la bitácora falla no se revierte nada: el cambio que pidió el usuario ya
 * está hecho y decirle que falló sería mentirle. Queda en el log del servidor.
 */
async function logForEachPlant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  plants: SelectedPlant[],
  userId: string,
  entry: { type: string; title: string; notes: string },
  createdAt: string
) {
  const { error } = await supabase.from('logs').insert(
    plants.map((plant) => ({
      plant_id: plant.id,
      cycle_id: plant.cycle_id,
      user_id: userId,
      type: entry.type,
      title: entry.title,
      notes: entry.notes,
      created_at: createdAt,
    }))
  );

  if (error) console.error('Error escribiendo la bitácora en lote:', error);
}

/**
 * Mueve de etapa a todas las plantas seleccionadas y fecha la etapa nueva.
 */
export async function bulkChangeStage(
  plantIds: number[],
  stage: string,
  date: string
): Promise<BulkResult> {
  const dateColumn = getStageDateColumn(stage);
  if (!dateColumn) return { success: false, error: 'Esa etapa no existe.' };

  const timestamp = toTimestamp(date);
  if (!timestamp) return { success: false, error: 'La fecha no es válida.' };

  const selection = await loadSelection(plantIds);
  if ('error' in selection) return { success: false, error: selection.error };

  const { supabase, userId, plants } = selection;

  const { error } = await supabase
    .from('plants')
    .update({
      stage,
      stage_updated_at: timestamp,
      // La columna sale del mapa de etapas, nunca del cliente.
      [dateColumn]: timestamp,
    })
    .in('id', plants.map((plant) => plant.id));

  if (error) {
    console.error('Error en el cambio de etapa en lote:', error);
    return { success: false, error: 'No se pudo cambiar la etapa.' };
  }

  await logForEachPlant(
    supabase,
    plants,
    userId,
    {
      type: 'cambio_etapa',
      title: `Cambio de etapa a ${stage}`,
      notes: `Cambio en lote sobre ${plantCountLabel(plants.length)}.`,
    },
    timestamp
  );

  revalidatePlantViews();
  return { success: true, count: plants.length };
}

/**
 * Registra un riego: pone al día `last_water` y deja la nota en la bitácora.
 */
export async function bulkWaterPlants(
  plantIds: number[],
  date: string,
  details: { amount?: string; nutrients?: string } = {}
): Promise<BulkResult> {
  const timestamp = toTimestamp(date);
  if (!timestamp) return { success: false, error: 'La fecha no es válida.' };

  const selection = await loadSelection(plantIds);
  if ('error' in selection) return { success: false, error: selection.error };

  const { supabase, userId, plants } = selection;

  const { error } = await supabase
    .from('plants')
    .update({ last_water: toDateOnly(date) })
    .in('id', plants.map((plant) => plant.id));

  if (error) {
    console.error('Error en el riego en lote:', error);
    return { success: false, error: 'No se pudo registrar el riego.' };
  }

  const amount = cleanText(details?.amount);
  const nutrients = cleanText(details?.nutrients);

  await logForEachPlant(
    supabase,
    plants,
    userId,
    {
      type: 'riego',
      title: 'Riego',
      notes: [
        `Riego en lote sobre ${plantCountLabel(plants.length)}.`,
        amount ? `Cantidad: ${amount}` : null,
        nutrients ? `Nutrientes: ${nutrients}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    },
    timestamp
  );

  revalidatePlantViews();
  return { success: true, count: plants.length };
}

/**
 * Archiva o devuelve al ruedo las plantas seleccionadas. Archivar no borra
 * nada: la planta sale del listado activo y su historial queda entero.
 */
export async function bulkSetArchived(
  plantIds: number[],
  archived: boolean,
  date: string,
  notes?: string
): Promise<BulkResult> {
  const timestamp = toTimestamp(date);
  if (!timestamp) return { success: false, error: 'La fecha no es válida.' };

  const selection = await loadSelection(plantIds);
  if ('error' in selection) return { success: false, error: selection.error };

  const { supabase, userId, plants } = selection;

  // `archived` llega del cliente: una server action es un endpoint público y
  // los tipos de TypeScript no existen en tiempo de ejecución.
  const isArchived = archived === true;

  const { error } = await supabase
    .from('plants')
    .update({ is_archived: isArchived })
    .in('id', plants.map((plant) => plant.id));

  if (error) {
    console.error('Error archivando plantas en lote:', error);
    return {
      success: false,
      error: isArchived ? 'No se pudieron archivar las plantas.' : 'No se pudieron restaurar las plantas.',
    };
  }

  const reason = cleanText(notes);

  await logForEachPlant(
    supabase,
    plants,
    userId,
    {
      type: 'otro',
      title: isArchived ? 'Archivada' : 'Restaurada',
      notes: reason || (isArchived ? 'Archivada en lote.' : 'Restaurada en lote.'),
    },
    timestamp
  );

  revalidatePlantViews();
  return { success: true, count: plants.length };
}

/**
 * Cambia de ciclo a las plantas seleccionadas, o las deja sueltas con
 * `cycleId` en null.
 */
export async function bulkMoveToCycle(
  plantIds: number[],
  cycleId: number | null
): Promise<BulkResult> {
  const targetId = cycleId === null ? null : Number(cycleId);
  if (targetId !== null && (!Number.isInteger(targetId) || targetId <= 0)) {
    return { success: false, error: 'Ese ciclo no es válido.' };
  }

  const selection = await loadSelection(plantIds);
  if ('error' in selection) return { success: false, error: selection.error };

  const { supabase, userId, plants } = selection;

  // El nombre es para la bitácora, pero la consulta también confirma que el
  // ciclo existe y es de quien lo pide: la RLS no devuelve los ajenos.
  let cycleName = '';
  if (targetId !== null) {
    const { data: cycle, error: cycleError } = await supabase
      .from('cycles')
      .select('id, name')
      .eq('id', targetId)
      .single();

    if (cycleError || !cycle) {
      return { success: false, error: 'No se encontró el ciclo de destino.' };
    }

    cycleName = cycle.name;
  }

  const { error } = await supabase
    .from('plants')
    .update({ cycle_id: targetId })
    .in('id', plants.map((plant) => plant.id));

  if (error) {
    console.error('Error moviendo plantas de ciclo:', error);
    return { success: false, error: 'No se pudieron mover las plantas.' };
  }

  const now = new Date().toISOString();

  await logForEachPlant(
    supabase,
    // La entrada cuelga del ciclo nuevo, que es donde va a leerse.
    plants.map((plant) => ({ ...plant, cycle_id: targetId })),
    userId,
    {
      type: 'otro',
      title: targetId === null ? 'Fuera de ciclo' : `Movida a ${cycleName}`,
      notes: `Cambio de ciclo en lote sobre ${plantCountLabel(plants.length)}.`,
    },
    now
  );

  revalidatePlantViews();
  return { success: true, count: plants.length };
}

/**
 * Borra las plantas seleccionadas. No deja bitácora, porque la bitácora cuelga
 * de la planta que se está yendo.
 */
export async function bulkDeletePlants(plantIds: number[]): Promise<BulkResult> {
  const selection = await loadSelection(plantIds);
  if ('error' in selection) return { success: false, error: selection.error };

  const { supabase, plants } = selection;

  const { error } = await supabase
    .from('plants')
    .delete()
    .in('id', plants.map((plant) => plant.id));

  if (error) {
    console.error('Error eliminando plantas en lote:', error);

    // Una madre con esquejes registrados no se puede borrar sin llevarse la
    // referencia de sus hijas, y el error crudo de Postgres no lo explica.
    if (error.code === '23503') {
      return {
        success: false,
        error: 'Alguna de las plantas es madre de esquejes registrados. Borrá primero los esquejes o desvinculalos.',
      };
    }

    return { success: false, error: 'No se pudieron eliminar las plantas.' };
  }

  revalidatePlantViews();
  return { success: true, count: plants.length };
}
