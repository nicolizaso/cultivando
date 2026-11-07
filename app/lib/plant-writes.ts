import 'server-only';

import type { ServerSupabase } from './auth';
import type { Json } from './database.types';
import { getStageDateColumn } from './stage-logic';
import type { StageName } from './stage-logic';

/**
 * ESCRITURAS DE PLANTAS Y CICLOS
 * ------------------------------------------------------------------
 * Lo que cambia una planta o un ciclo, y su registro en la bitácora, escrito
 * en un solo lugar. Lo usan las acciones manuales (regar, cambiar de etapa,
 * archivar, mover) y las tareas al completarse: así una tarea deja el mismo
 * rastro que hacerlo a mano, más el id de la tarea en `data.task_id` para
 * poder deshacerla.
 *
 * Nada de esto revalida rutas ni pide sesión: lo hace la acción que llama.
 */

export interface PlantRef {
  id: number;
  cycle_id: number | null;
}

export interface LogEntry {
  type: string;
  title: string;
  notes?: string | null;
  data?: Record<string, unknown> | null;
}

function logData(entry: LogEntry, taskId?: number): Json | null {
  const data = { ...(entry.data ?? {}), ...(taskId ? { task_id: taskId } : {}) };
  return Object.keys(data).length > 0 ? (data as Json) : null;
}

/**
 * Un registro por planta, colgado también de su ciclo cuando lo tiene.
 * Devuelve los ids escritos. Si la bitácora falla no se revierte nada: el
 * cambio ya está hecho, y queda en el log del servidor.
 */
export async function writePlantLogs(
  supabase: ServerSupabase,
  userId: string,
  plants: PlantRef[],
  entry: LogEntry,
  createdAt: string,
  taskId?: number
): Promise<number[]> {
  if (plants.length === 0) return [];
  const data = logData(entry, taskId);
  const { data: rows, error } = await supabase
    .from('logs')
    .insert(plants.map((plant) => ({
      plant_id: plant.id,
      cycle_id: plant.cycle_id,
      user_id: userId,
      type: entry.type,
      title: entry.title,
      notes: entry.notes || null,
      data,
      created_at: createdAt,
    })))
    .select('id');

  if (error) {
    console.error('Error escribiendo la bitácora:', error);
    return [];
  }
  return (rows ?? []).map((row) => Number(row.id));
}

/** Un registro de todo el ciclo (sin planta), como una mudanza. */
export async function writeCycleLog(
  supabase: ServerSupabase,
  userId: string,
  cycleId: number,
  entry: LogEntry,
  createdAt: string,
  taskId?: number
): Promise<number | null> {
  const { data: row, error } = await supabase
    .from('logs')
    .insert({
      cycle_id: cycleId,
      plant_id: null,
      user_id: userId,
      type: entry.type,
      title: entry.title,
      notes: entry.notes || null,
      data: logData(entry, taskId),
      created_at: createdAt,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error escribiendo la bitácora del ciclo:', error);
    return null;
  }
  return Number(row.id);
}

/**
 * Etapa nueva con su fecha: la etapa, la columna de fecha de esa etapa y
 * `stage_updated_at`, siempre juntas. La columna sale del mapa de etapas,
 * nunca del cliente.
 */
export async function setPlantsStage(
  supabase: ServerSupabase,
  ids: number[],
  stage: StageName,
  timestamp: string
): Promise<{ error: unknown }> {
  const column = getStageDateColumn(stage);
  if (!column) return { error: new Error(`Etapa desconocida: ${stage}`) };
  if (ids.length === 0) return { error: null };
  const { error } = await supabase
    .from('plants')
    .update({ stage, stage_updated_at: timestamp, [column]: timestamp })
    .in('id', ids);
  return { error };
}

/** `last_water` guarda el día de calendario ("YYYY-MM-DD"). */
export async function setPlantsWatered(supabase: ServerSupabase, ids: number[], day: string): Promise<{ error: unknown }> {
  if (ids.length === 0) return { error: null };
  const { error } = await supabase.from('plants').update({ last_water: day }).in('id', ids);
  return { error };
}

export async function setPlantsArchived(supabase: ServerSupabase, ids: number[], archived: boolean): Promise<{ error: unknown }> {
  if (ids.length === 0) return { error: null };
  const { error } = await supabase.from('plants').update({ is_archived: archived }).in('id', ids);
  return { error };
}

export async function setPlantsCycle(supabase: ServerSupabase, ids: number[], cycleId: number | null): Promise<{ error: unknown }> {
  if (ids.length === 0) return { error: null };
  const { error } = await supabase.from('plants').update({ cycle_id: cycleId }).in('id', ids);
  return { error };
}

/** Las plantas no guardan espacio: viven en su ciclo y se mudan con él. */
export async function setCycleSpace(supabase: ServerSupabase, cycleId: number, spaceId: number | null): Promise<{ error: unknown }> {
  const { error } = await supabase.from('cycles').update({ space_id: spaceId }).eq('id', cycleId);
  return { error };
}
