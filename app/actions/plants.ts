"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/lib/auth";
import type { ServerSupabase } from "@/app/lib/auth";
import { friendlyDbError } from "@/app/lib/errors";
import { LOG_TYPE } from "@/app/lib/logs";
import { STAGE_DATE_COLUMNS, STAGE_NAMES, getStageDateColumn, isStageName } from "@/app/lib/stage-logic";
import type { StageName } from "@/app/lib/stage-logic";
import { dateKey, parseCultivationDate, todayKey } from "@/app/lib/dates";
import { parseId, parseIds } from "@/app/lib/sanitize";
import { IMAGES_BUCKET, storagePathFromPublicUrl } from "@/app/lib/uploads";
import { plantCountLabel } from "@/app/lib/utils";

type BulkResult = { success: boolean; count?: number; error?: string };

type SourceType = 'Semilla' | 'Esqueje';

/** Etapas en las que puede arrancar una planta nueva según su origen. */
const START_STAGES: Record<SourceType, StageName[]> = {
  Semilla: ['Germinación', 'Plántula', 'Vegetativo', 'Floración'],
  Esqueje: ['Enraizamiento', 'Vegetativo', 'Floración'],
};

/** Tope de plantas por alta: frena un stepper trabado o un payload armado a mano. */
const MAX_PLANTS_PER_BATCH = 100;

/** Texto de formulario ya recortado, o cadena vacía si no vino texto. */
function cleanText(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
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

/** Confirma que el ciclo existe y es del usuario (la RLS no devuelve ajenos). */
async function findCycle(supabase: ServerSupabase, cycleId: number) {
  const { data } = await supabase.from('cycles').select('id, name').eq('id', cycleId).maybeSingle();
  return data;
}

/* --------------------------------------------------------------------------
 * Alta, edición y borrado de una planta
 *
 * Antes se hacían desde el navegador directo contra la base. Eso salteaba
 * cualquier validación y dejaba datos a medias: una planta nueva no anotaba
 * la fecha de su etapa, así que la ficha decía "0 días en etapa" para
 * siempre, y los esquejes nacían en Germinación.
 * ----------------------------------------------------------------------- */

interface NewPlantsInput {
  strain?: unknown;
  name?: unknown;
  breeder?: unknown;
  source_type?: unknown;
  mother_id?: unknown;
  stage?: unknown;
  cycle_id?: unknown;
  planted_at?: unknown;
  quantity?: unknown;
}

/**
 * Crea una o varias plantas iguales en un ciclo. Cada una nace con la fecha
 * de su etapa inicial anotada (la misma que `planted_at`) y sin riego.
 */
export async function createPlants(input: NewPlantsInput) {
  const session = await requireUser();
  if ('error' in session) return { success: false, error: session.error };
  const { supabase, user } = session;

  const strain = cleanText(input?.strain, 80);
  const baseName = cleanText(input?.name, 80) || strain;
  const breeder = cleanText(input?.breeder, 80) || null;
  const sourceType: SourceType = input?.source_type === 'Esqueje' ? 'Esqueje' : 'Semilla';
  const cycleId = parseId(input?.cycle_id);
  const quantity = Math.floor(Number(input?.quantity ?? 1));
  const plantedDay = dateKey(typeof input?.planted_at === 'string' ? input.planted_at : todayKey()) ?? todayKey();
  const stage = isStageName(input?.stage) && START_STAGES[sourceType].includes(input.stage)
    ? input.stage
    : START_STAGES[sourceType][0];

  if (!strain) return { success: false, error: 'Completá la genética.' };
  if (!cycleId) return { success: false, error: 'Elegí un ciclo.' };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PLANTS_PER_BATCH) {
    return { success: false, error: `La cantidad tiene que estar entre 1 y ${MAX_PLANTS_PER_BATCH}.` };
  }

  if (!(await findCycle(supabase, cycleId))) return { success: false, error: 'No se encontró el ciclo.' };

  let motherId: number | null = null;
  if (sourceType === 'Esqueje') {
    motherId = parseId(input?.mother_id);
    if (motherId) {
      const { data: mother } = await supabase.from('plants').select('id').eq('id', motherId).maybeSingle();
      if (!mother) return { success: false, error: 'No se encontró la planta madre.' };
    }
  }

  const timestamp = toTimestamp(plantedDay)!;
  const stageColumn = getStageDateColumn(stage)!;

  const rows = Array.from({ length: quantity }, (_, index) => ({
    name: quantity > 1 ? `${baseName} #${index + 1}` : baseName,
    strain,
    breeder,
    source_type: sourceType,
    mother_id: motherId,
    cycle_id: cycleId,
    user_id: user.id,
    stage,
    planted_at: timestamp,
    stage_updated_at: timestamp,
    // La columna sale del mapa de etapas, nunca del cliente.
    [stageColumn]: timestamp,
    last_water: null,
  }));

  const { data, error } = await supabase.from('plants').insert(rows).select('id');

  if (error) {
    return { success: false, error: friendlyDbError(error, 'No se pudieron crear las plantas.', {}, 'Error creando plantas:') };
  }

  revalidatePlantViews();
  return { success: true, count: rows.length, plantIds: (data ?? []).map((plant) => Number(plant.id)) };
}

/** El alta rápida del primer ciclo (onboarding). */
export async function createPlantsBulk(
  count: number,
  strain: string,
  sourceType: 'Semilla' | 'Esqueje',
  cycleId: number
) {
  return createPlants({ quantity: count, strain, source_type: sourceType, cycle_id: cycleId, planted_at: todayKey() });
}

interface PlantUpdateInput {
  name?: unknown;
  strain?: unknown;
  breeder?: unknown;
  source_type?: unknown;
  cycle_id?: unknown;
  /** Fecha de inicio de cada etapa, por columna (`date_floracion`…). Vacío borra la etapa. */
  dates?: Record<string, unknown>;
}

/**
 * Guarda la ficha de una planta. La etapa no se elige: sale de la línea de
 * tiempo (la última etapa con fecha), y `stage_updated_at` es esa fecha, así
 * todas las pantallas cuentan los días en etapa igual.
 */
export async function updatePlant(plantId: number, input: PlantUpdateInput) {
  const session = await requireUser();
  if ('error' in session) return { success: false, error: session.error };
  const { supabase } = session;

  const id = parseId(plantId);
  if (!id) return { success: false, error: 'Esa planta no es válida.' };

  const { data: current } = await supabase.from('plants').select('id, stage, planted_at, cycle_id').eq('id', id).maybeSingle();
  if (!current) return { success: false, error: 'No se encontró la planta.' };

  const name = cleanText(input?.name, 80);
  if (!name) return { success: false, error: 'La planta necesita un nombre.' };

  const sourceType: SourceType = input?.source_type === 'Esqueje' ? 'Esqueje' : 'Semilla';

  let cycleId: number | null = null;
  if (input?.cycle_id !== null && input?.cycle_id !== undefined && input?.cycle_id !== '') {
    cycleId = parseId(input.cycle_id);
    if (!cycleId) return { success: false, error: 'Ese ciclo no es válido.' };
    if (cycleId !== current.cycle_id && !(await findCycle(supabase, cycleId))) {
      return { success: false, error: 'No se encontró el ciclo.' };
    }
  }

  // Las siete fechas, cada una anclada al mediodía si vino sin hora.
  const stageDates: Record<string, string | null> = {};
  for (const stage of STAGE_NAMES) {
    const column = STAGE_DATE_COLUMNS[stage];
    const raw = input?.dates?.[column];
    if (raw === undefined) continue;
    if (raw === null || raw === '') {
      stageDates[column] = null;
      continue;
    }
    const timestamp = toTimestamp(raw);
    if (!timestamp) return { success: false, error: `La fecha de ${stage} no es válida.` };
    stageDates[column] = timestamp;
  }

  const updates: Record<string, unknown> = {
    name,
    strain: cleanText(input?.strain, 80) || null,
    breeder: cleanText(input?.breeder, 80) || null,
    source_type: sourceType,
    cycle_id: cycleId,
    ...stageDates,
  };

  // La etapa y desde cuándo: la última de la línea de tiempo con fecha.
  if (Object.keys(stageDates).length > 0) {
    const latest = [...STAGE_NAMES].reverse().find((stage) => stageDates[STAGE_DATE_COLUMNS[stage]]);
    if (latest) {
      updates.stage = latest;
      updates.stage_updated_at = stageDates[STAGE_DATE_COLUMNS[latest]];
    }

    // La edad cuenta desde la primera etapa con fecha.
    const first = STAGE_NAMES.find((stage) => stageDates[STAGE_DATE_COLUMNS[stage]]);
    if (first) updates.planted_at = stageDates[STAGE_DATE_COLUMNS[first]];
  }

  const { error } = await supabase.from('plants').update(updates).eq('id', id);
  if (error) return { success: false, error: friendlyDbError(error, 'No se pudieron guardar los cambios.', {}, 'Error actualizando la planta:') };

  revalidatePlantViews();
  return { success: true };
}

/** Borra una planta (con su bitácora y sus fotos). */
export async function deletePlant(plantId: number) {
  return bulkDeletePlants([plantId]);
}

/** Riego rápido desde la tarjeta: hoy. */
export async function waterPlant(plantId: number) {
  return bulkWaterPlants([plantId], todayKey());
}

/** Cambio de etapa de una planta a partir de hoy (el sugeridor del panel). */
export async function changePlantStage(plantId: number, stage: string) {
  return bulkChangeStage([plantId], stage, todayKey());
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

/** Una planta tal como la necesitan estas acciones: quién es y de qué ciclo. */
interface SelectedPlant {
  id: number;
  name: string;
  cycle_id: number | null;
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

  const session = await requireUser();
  if ('error' in session) return { error: session.error };
  const { supabase, user } = session;

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
  supabase: ServerSupabase,
  plants: SelectedPlant[],
  userId: string,
  entry: { type: string; title: string; notes: string; data?: Record<string, unknown> | null },
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
      data: entry.data ?? null,
      created_at: createdAt,
    }))
  );

  if (error) console.error('Error escribiendo la bitácora en lote:', error);
}

/**
 * Mueve de etapa a todas las plantas seleccionadas y fecha la etapa nueva.
 * Es el único camino para cambiar de etapa: escribe juntas la etapa, la fecha
 * de esa etapa y `stage_updated_at`.
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
    return { success: false, error: friendlyDbError(error, 'No se pudo cambiar la etapa.', {}, 'Error en el cambio de etapa en lote:') };
  }

  await logForEachPlant(
    supabase,
    plants,
    userId,
    {
      type: LOG_TYPE.stage,
      title: `Cambio de etapa a ${stage}`,
      notes: plants.length > 1 ? `Cambio en lote sobre ${plantCountLabel(plants.length)}.` : '',
    },
    timestamp
  );

  revalidatePlantViews();
  return { success: true, count: plants.length };
}

/**
 * Registra un riego: pone al día `last_water` (el día de calendario) y deja la
 * nota en la bitácora.
 */
export async function bulkWaterPlants(
  plantIds: number[],
  date: string,
  details: { amount?: string; nutrients?: string } = {}
): Promise<BulkResult> {
  const timestamp = toTimestamp(date);
  const day = dateKey(date);
  if (!timestamp || !day) return { success: false, error: 'La fecha no es válida.' };

  const selection = await loadSelection(plantIds);
  if ('error' in selection) return { success: false, error: selection.error };

  const { supabase, userId, plants } = selection;

  const { error } = await supabase
    .from('plants')
    .update({ last_water: day })
    .in('id', plants.map((plant) => plant.id));

  if (error) {
    return { success: false, error: friendlyDbError(error, 'No se pudo registrar el riego.', {}, 'Error en el riego en lote:') };
  }

  const amount = cleanText(details?.amount);
  const nutrients = cleanText(details?.nutrients);

  await logForEachPlant(
    supabase,
    plants,
    userId,
    {
      type: LOG_TYPE.water,
      title: 'Riego',
      notes: [
        plants.length > 1 ? `Riego en lote sobre ${plantCountLabel(plants.length)}.` : null,
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
    return {
      success: false,
      error: friendlyDbError(
        error,
        isArchived ? 'No se pudieron archivar las plantas.' : 'No se pudieron restaurar las plantas.',
        {},
        'Error archivando plantas en lote:'
      ),
    };
  }

  const reason = cleanText(notes, 500);

  await logForEachPlant(
    supabase,
    plants,
    userId,
    {
      type: LOG_TYPE.other,
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
    const cycle = await findCycle(supabase, targetId);
    if (!cycle) {
      return { success: false, error: 'No se encontró el ciclo de destino.' };
    }

    cycleName = cycle.name;
  }

  const { error } = await supabase
    .from('plants')
    .update({ cycle_id: targetId })
    .in('id', plants.map((plant) => plant.id));

  if (error) {
    return { success: false, error: friendlyDbError(error, 'No se pudieron mover las plantas.', {}, 'Error moviendo plantas de ciclo:') };
  }

  const now = new Date().toISOString();

  await logForEachPlant(
    supabase,
    // La entrada cuelga del ciclo nuevo, que es donde va a leerse.
    plants.map((plant) => ({ ...plant, cycle_id: targetId })),
    userId,
    {
      type: LOG_TYPE.other,
      title: targetId === null ? 'Fuera de ciclo' : `Movida a ${cycleName}`,
      notes: `Cambio de ciclo en lote sobre ${plantCountLabel(plants.length)}.`,
    },
    now
  );

  revalidatePlantViews();
  return { success: true, count: plants.length };
}

/**
 * Borra las plantas seleccionadas. Su bitácora se va con ellas (la base la
 * borra en cascada) y sus fotos se borran del bucket.
 */
export async function bulkDeletePlants(plantIds: number[]): Promise<BulkResult> {
  const selection = await loadSelection(plantIds);
  if ('error' in selection) return { success: false, error: selection.error };

  const { supabase, plants } = selection;
  const ids = plants.map((plant) => plant.id);

  // Las fotos se juntan antes de borrar: después ya no hay de dónde leerlas.
  const [{ data: photoLogs }, { data: covers }] = await Promise.all([
    supabase.from('logs').select('media_url').in('plant_id', ids),
    supabase.from('plants').select('image_url').in('id', ids),
  ]);

  const paths = new Set<string>();
  for (const log of photoLogs ?? []) for (const url of log.media_url ?? []) {
    const path = storagePathFromPublicUrl(url);
    if (path) paths.add(path);
  }
  for (const plant of covers ?? []) {
    const path = storagePathFromPublicUrl(plant.image_url);
    if (path) paths.add(path);
  }

  const { error } = await supabase.from('plants').delete().in('id', ids);

  if (error) {
    // Una madre con esquejes registrados no se podía borrar sin llevarse la
    // referencia de sus hijas, y el error crudo de Postgres no lo explicaba.
    return {
      success: false,
      error: friendlyDbError(error, 'No se pudieron eliminar las plantas.', {
        '23503': 'Alguna de las plantas es madre de esquejes registrados. Borrá primero los esquejes o desvinculalos.',
      }, 'Error eliminando plantas en lote:'),
    };
  }

  if (paths.size > 0) {
    const { error: storageError } = await supabase.storage.from(IMAGES_BUCKET).remove(Array.from(paths));
    if (storageError) console.error('No se pudieron borrar las fotos de las plantas:', storageError);
  }

  revalidatePlantViews();
  return { success: true, count: plants.length };
}
